"""
Gemini API client for PCB component analysis.
Uses function calling to call search_components for each component type.
"""

import json
import re
from typing import Generator, Any
from google import genai
from google.genai import types
from tools import SEARCH_COMPONENTS_TOOL, search_components

COMPONENT_LEVELS = {
    "mcu": 0,
    "power": 1,
    "sensor": 1,
    "memory": 2,
    "antenna": 2,
    "connector": 3,
    "passive": 3,
    "other": 3,
}

SYSTEM_PROMPT = """You are an expert PCB design assistant. Your job is to analyze circuit board requirements and select specific components.

When given a design request:
1. Identify ALL required components in hierarchical order: MCU first, then power management, then sensors/memory/antenna, finally passives and connectors
2. For each component, briefly explain your reasoning (1-2 sentences max)
3. ALWAYS call search_components to find the actual part — even if you already picked a similar part for another category
4. After receiving search results, confirm the selection
5. Move on to the NEXT component category and repeat steps 2-4

CRITICAL RULES:
- You MUST call search_components for EVERY component category. Never skip a category.
- NEVER reuse a part selected for one category in another category — always run a new search.
- Do not finish until every required category has had its own search_components call.
- At minimum, a typical design requires separate calls for: MCU, power management, sensors, and connectors.
- Call search_components once per component — do NOT batch multiple categories into one call.

Structure your analysis clearly. For each component, start with "## [ComponentName]" as a header.

Be concise and technical. Focus on specifications: voltage compatibility, interfaces, package size, availability."""

COMPONENT_MAP: dict[str, tuple[str, str]] = {
    "microcontroller": ("mcu", "Microcontroller"),
    "mcu": ("mcu", "Microcontroller"),
    "processor": ("mcu", "Microcontroller"),
    "esp32": ("mcu", "Microcontroller"),
    "arduino": ("mcu", "Microcontroller"),
    "power": ("power", "Power Management"),
    "regulator": ("power", "Power Management"),
    "ldo": ("power", "Power Management"),
    "voltage": ("power", "Power Management"),
    "temperature": ("sensor", "Temperature Sensor"),
    "humidity": ("sensor", "Humidity Sensor"),
    "sensor": ("sensor", "Sensor"),
    "bme": ("sensor", "Environmental Sensor"),
    "memory": ("memory", "Memory"),
    "flash": ("memory", "Flash Memory"),
    "eeprom": ("memory", "EEPROM"),
    "antenna": ("antenna", "Antenna"),
    "wifi": ("antenna", "WiFi Module"),
    "bluetooth": ("antenna", "BT Module"),
    "capacitor": ("passive", "Capacitor"),
    "resistor": ("passive", "Resistor"),
    "inductor": ("passive", "Inductor"),
    "passive": ("passive", "Passive Component"),
    "connector": ("connector", "Connector"),
    "usb": ("connector", "USB Connector"),
    "header": ("connector", "Header"),
}


def _extract_component_info(text: str) -> tuple[str, str, int]:
    """Extract component ID, name, and hierarchy level from text."""
    text_lower = text.lower()

    header_match = re.search(r"##\s+([^\n]+)", text)
    if header_match:
        header = header_match.group(1).strip().lower()
        for keyword, (comp_id, comp_name) in COMPONENT_MAP.items():
            if keyword in header:
                return comp_id, comp_name, COMPONENT_LEVELS.get(comp_id, 3)

    for keyword, (comp_id, comp_name) in COMPONENT_MAP.items():
        if keyword in text_lower:
            return comp_id, comp_name, COMPONENT_LEVELS.get(comp_id, 3)

    return "analyzing", "Component", 3


def _make_config(max_output_tokens: int = 4096) -> types.GenerateContentConfig:
    """Build the Gemini generation config with tools and system instruction."""
    tool = types.Tool(function_declarations=[SEARCH_COMPONENTS_TOOL])
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[tool],
        max_output_tokens=max_output_tokens,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


def _make_function_response_part(fc) -> types.Part:
    """Execute a function call and return a Gemini function-response Part."""
    args = dict(fc.args) if fc.args else {}
    components = search_components(
        args.get("query", ""),
        args.get("category", "other"),
        args.get("specifications"),
    )
    return types.Part.from_function_response(
        name=fc.name, response={"result": components}
    ), components, args


def _history_to_contents(messages: list[dict]) -> list[types.Content]:
    """Convert simple {role, content} message dicts to Gemini Content objects."""
    contents = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else msg["role"]
        contents.append(
            types.Content(role=role, parts=[types.Part(text=msg["content"])])
        )
    return contents


def stream_component_analysis(
    query: str,
    model: str,
    client: genai.Client,
    context: str | None = None,
) -> Generator[dict[str, Any], None, None]:
    """
    Stream component analysis using Gemini with function calling.
    Yields structured events matching the frontend's ComponentAnalysisResponse format.
    """
    user_text = f"Design requirements: {query}"
    if context:
        user_text += f"\n\nAdditional context: {context}"

    contents: list[types.Content] = [
        types.Content(role="user", parts=[types.Part(text=user_text)])
    ]
    config = _make_config(max_output_tokens=4096)

    current_component_id = "analyzing"
    current_component_name = "Component"
    current_hierarchy = 0
    reasoning_buffer = ""
    selected_component_ids: set[str] = set()

    # Agentic loop: Gemini may request tool calls multiple times
    while True:
        full_text = ""
        function_calls: list = []
        all_parts: list[types.Part] = []

        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config,
        ):
            if not chunk.candidates or not chunk.candidates[0].content:
                continue

            for part in chunk.candidates[0].content.parts:
                if part.text:
                    text = part.text
                    full_text += text
                    reasoning_buffer += text

                    comp_id, comp_name, hierarchy = _extract_component_info(reasoning_buffer)
                    if comp_id != "analyzing":
                        current_component_id = comp_id
                        current_component_name = comp_name
                        current_hierarchy = hierarchy

                    if (
                        text.strip()
                        and len(text) > 10
                        and current_component_id not in selected_component_ids
                    ):
                        yield {
                            "type": "reasoning",
                            "componentId": current_component_id,
                            "componentName": current_component_name,
                            "reasoning": text.strip(),
                            "hierarchyLevel": current_hierarchy,
                        }

                if part.function_call:
                    function_calls.append(part.function_call)

                all_parts.append(part)

        # Append model turn to conversation history
        if all_parts:
            contents.append(types.Content(role="model", parts=all_parts))

        if not function_calls:
            break

        # Execute each function call and build response parts
        response_parts: list[types.Part] = []
        for fc in function_calls:
            fr_part, components, args = _make_function_response_part(fc)
            response_parts.append(fr_part)

            query_str = args.get("query", "")
            category = args.get("category", "other")
            comp_id, comp_name, hierarchy = _extract_component_info(
                f"{category} {query_str}"
            )
            if comp_id != "analyzing":
                current_component_id = comp_id
                current_component_name = comp_name
                current_hierarchy = hierarchy

            if components:
                part_data = components[0]
                if "mpn" in part_data and "manufacturer" in part_data:
                    if current_component_id not in selected_component_ids:
                        yield {
                            "type": "reasoning",
                            "componentId": current_component_id,
                            "componentName": current_component_name,
                            "reasoning": f"Searching for {current_component_name}...",
                            "hierarchyLevel": current_hierarchy,
                        }
                    yield {
                        "type": "selection",
                        "componentId": current_component_id,
                        "componentName": current_component_name,
                        "partData": part_data,
                        "hierarchyLevel": current_hierarchy,
                    }
                    selected_component_ids.add(current_component_id)
                    reasoning_buffer = ""

        contents.append(types.Content(role="user", parts=response_parts))

    yield {
        "type": "complete",
        "message": "Component analysis complete.",
    }


def get_chat_response(
    query: str,
    model: str,
    client: genai.Client,
    conversation_history: list[dict] | None = None,
) -> str:
    """
    Get a non-streaming chat response for the /mcp/query endpoint.
    Implements an agentic loop to handle any function calls before returning text.
    """
    contents = _history_to_contents(conversation_history) if conversation_history else []
    contents.append(types.Content(role="user", parts=[types.Part(text=query)]))

    config = _make_config(max_output_tokens=1024)

    while True:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        function_calls = []
        text_parts = []

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    function_calls.append(part.function_call)
                if part.text:
                    text_parts.append(part.text)

            contents.append(response.candidates[0].content)

        if not function_calls:
            return " ".join(text_parts) if text_parts else "Analysis complete."

        response_parts = []
        for fc in function_calls:
            fr_part, _, _ = _make_function_response_part(fc)
            response_parts.append(fr_part)

        contents.append(types.Content(role="user", parts=response_parts))
