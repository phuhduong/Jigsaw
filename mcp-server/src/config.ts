/**
 * Configuration management
 */
import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  clientId: string;
  clientSecret: string;
  port: number;
  isProduction: boolean;
}

export function loadConfig(): Config {
  const clientId = process.env.DIGIKEY_CLIENT_ID;
  const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

  if (!clientId) {
    throw new Error('DIGIKEY_CLIENT_ID environment variable is required');
  }

  if (!clientSecret) {
    throw new Error('DIGIKEY_CLIENT_SECRET environment variable is required');
  }

  const port = parseInt(process.env.PORT || '8080', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  return { clientId, clientSecret, port, isProduction };
}
