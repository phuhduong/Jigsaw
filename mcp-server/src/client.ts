/**
 * DigiKey API Client
 * Handles OAuth2 authentication and keyword search
 */
import axios, { AxiosInstance } from 'axios';
import { PartObject, DigiKeySearchResponse, DigiKeyTokenResponse, DigiKeyProduct } from './types.js';

export class DigiKeyClient {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string = 'https://api.digikey.com/v1/oauth2/token';
  private searchUrl: string = 'https://api.digikey.com/products/v4/search/keyword';
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private axiosInstance: AxiosInstance;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error('DIGIKEY_CLIENT_ID and DIGIKEY_CLIENT_SECRET must be set');
    }

    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  /**
   * Get OAuth2 access token with caching and auto-refresh
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 30s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30000) {
      return this.accessToken;
    }

    try {
      const response = await this.axiosInstance.post<DigiKeyTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
      return this.accessToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`DigiKey authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract a parameter value from DigiKey product parameters
   */
  private extractParam(parameters: DigiKeyProduct['Parameters'], ...keywords: string[]): string | undefined {
    for (const param of parameters) {
      const text = param.ParameterText.toLowerCase();
      if (keywords.some((kw) => text.includes(kw))) {
        return param.ValueText;
      }
    }
    return undefined;
  }

  /**
   * Extract all matching parameter values (for multi-value fields like interfaces)
   */
  private extractParams(parameters: DigiKeyProduct['Parameters'], ...keywords: string[]): string[] {
    const values: string[] = [];
    for (const param of parameters) {
      const text = param.ParameterText.toLowerCase();
      if (keywords.some((kw) => text.includes(kw)) && param.ValueText) {
        values.push(...param.ValueText.split(',').map((v) => v.trim()).filter(Boolean));
      }
    }
    return values;
  }

  /**
   * Map a DigiKey product to our PartObject format
   */
  private mapProduct(product: DigiKeyProduct): PartObject {
    const params = product.Parameters || [];

    const voltage = this.extractParam(params, 'voltage');
    const packageType = this.extractParam(params, 'package', 'case');
    const interfaces = this.extractParams(params, 'interface');

    const component: PartObject = {
      mpn: product.ManufacturerProductNumber || product.DigiKeyPartNumber,
      manufacturer: product.Manufacturer?.Name || '',
      description: product.Description?.ProductDescription || '',
      price: typeof product.UnitPrice === 'number' ? product.UnitPrice : parseFloat(String(product.UnitPrice)) || 0,
      currency: product.Currency || 'USD',
      quantity: 1,
    };

    if (voltage) component.voltage = voltage;
    if (packageType) component.package = packageType;
    if (interfaces.length > 0) component.interfaces = interfaces;
    if (product.DatasheetUrl) component.datasheet = product.DatasheetUrl;

    return component;
  }

  /**
   * Search for components using DigiKey keyword search API v4
   */
  async searchComponents(query: string, limit: number = 5): Promise<PartObject[]> {
    const token = await this.getAccessToken();

    const requestBody = {
      Keywords: query,
      Limit: limit,
      Offset: 0,
      FilterOptionsRequest: {
        ManufacturerFilter: [],
        MinimumQuantityAvailable: 1,
      },
      ExcludeMarketPlaceProducts: true,
    };

    try {
      const response = await this.axiosInstance.post<DigiKeySearchResponse>(
        this.searchUrl,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-DIGIKEY-Client-Id': this.clientId,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const products = response.data.Products || [];
      return products.map((p) => this.mapProduct(p));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        throw new Error(`DigiKey API request failed: ${detail}`);
      }
      throw error;
    }
  }
}
