import { createScopedLogger } from '~/utils/logger';

const FIGMA_API_URL = 'https://api.figma.com/v1/files';
const FIGMA_TOKEN = 'figd_p5W7xMa2C-pJ8Mf7DpzQv7RN6TkzgW9-gi3EM0nk';

const logger = createScopedLogger('figmaClient');

interface FigmaResponse {
  // Define the structure of the response based on Figma API documentation
  nodes: Record<string, any>;
}

async function getFigmaNodes(fileKey: string, nodeId: string): Promise<FigmaResponse> {
  const url = `${FIGMA_API_URL}/${fileKey}/nodes?ids=${nodeId}`;
  const headers = {
    'X-Figma-Token': FIGMA_TOKEN,
  };
  logger.info(`Fetching Figma nodes from ${url}`);

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Error fetching Figma nodes: ${response.statusText}`);
    }

    const data: FigmaResponse = await response.json();

    return data;
  } catch (error) {
    console.error('Error fetching Figma nodes:', error);
    throw error;
  }
}

function extractFileKeyAndNodeId(figmaUrl: string): { fileKey: string; nodeId: string } | null {
  const regex = /https:\/\/www\.figma\.com\/design\/([^\/]+)\/[^?]+\?node-id=([^&]+)&?/;
  const match = figmaUrl.match(regex);

  if (match) {
    const fileKey = match[1];
    const nodeId = match[2];

    return { fileKey, nodeId };
  }

  return null;
}

async function getFigmaResponseFromUrl(figmaUrl: string): Promise<FigmaResponse | null> {
  const extracted = extractFileKeyAndNodeId(figmaUrl);
  logger.info(`Extracted ${extracted}`);

  if (!extracted) {
    logger.error(`Error fetching Figma response from url: ${figmaUrl}`);
    return null;
  }

  const { fileKey, nodeId } = extracted;

  try {
    return await getFigmaNodes(fileKey, nodeId);
  } catch (error) {
    logger.error(`Error getting Figma response from url: ${error}`);
    return null;
  }
}

export { getFigmaNodes, extractFileKeyAndNodeId, getFigmaResponseFromUrl };
