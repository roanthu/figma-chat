import { generateText, type CoreTool, type GenerateTextResult, type Message } from 'ai';
import ignore from 'ignore';
import type { IProviderSetting } from '~/types/model';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getFigmaJsonPromptV2 } from '~/lib/common/prompts/figmaJsonPromptV2';
import type { FigmaFile } from '~/components/chat/figmaClient';
import { extractPropertiesFromMessage, simplifyBoltActions } from './utils';


// Common patterns to ignore, similar to .gitignore

const ig = ignore().add(IGNORE_PATTERNS);
const logger = createScopedLogger('select-context');

export async function genHtmlCss(props: {
  figmaFile: FigmaFile;
  messages: Message[]
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean}) {
  const {messages, env: serverEnv, apiKeys, providerSettings, figmaFile } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    }
    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }


  return processNode(currentModel,
    serverEnv,
    apiKeys,
    providerSettings,
    currentProvider,
    extractDocumentsFromFigmaJson(figmaFile));
}


function extractDocumentsFromFigmaJson(figmaJson: FigmaFile): any {
  return Object.values(figmaJson.nodes).map((node) => node.document)[0];
}


//viết hàm với input là FigmaFile trả về kết quả html, css tương ứng với FigmaFile
// export function getHtmlCssFromFigmaFile(figmaFile: FigmaFile): { html: string; css: string } {
export async function getHtmlCssFromFigmaFile({
                                                figmaFile,
                                                currentModel,
                                                serverEnv,
                                                apiKeys,
                                                providerSettings,
                                                currentProvider
                                              }: {
  figmaFile: FigmaFile,
  currentModel: any,
  serverEnv: any,
  apiKeys: any,
  providerSettings: any,
  currentProvider: any
}): Promise<{ html: string; css: string }> {

  let systemPrompt = getFigmaJsonPromptV2()
  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;

  const resp = await generateText({
    system: `${systemPrompt}`,
    prompt: getParentAndChildrenPrompt('', '', JSON.stringify(figmaFile)),
    model: provider.getModelInstance({
      model: currentModel,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
  });

  const response = resp.text;
  // logger.debug('Response:', response);
  const htmlMatch = response.match(/<html-block>([\s\S]*?)<\/html-block>/);
  const cssMatch = response.match(/<css-block>([\s\S]*?)<\/css-block>/);

  const html = htmlMatch ? htmlMatch[1].trim() : '';
  const css = cssMatch ? cssMatch[1].trim() : '';
  return { html, css };

}

export async function processNode(
  currentModel: any,
  serverEnv: any,
  apiKeys: any,
  providerSettings: any,
  currentProvider: any,
  parentNode: any,
): Promise<{ html: string; css: string; }> {
  let childrenHTML = '';
  let childrenCSS = '';

  const parentNodeString = JSON.stringify(parentNode);
  //log debug parentNodeString.length
  logger.debug('1. Parent Node String Length:', parentNodeString.length,  'children length: ', parentNode.children?.length);
  if (parentNode.children && parentNode.children.length > 0 && parentNodeString.length > 50000) {
    const childrens = await Promise.all(parentNode.children.map((child: any) =>
      processNode(currentModel, serverEnv, apiKeys, providerSettings, currentProvider, child)));
    childrenCSS = childrens.map((child) => child.css).join('\n');
    childrenHTML = childrens.map((child) => child.html).join('\n');
    parentNode.children = null;
  }
  logger.debug('2. Parent Node String Length:', parentNodeString.length);

  let systemPrompt = getFigmaJsonPromptV2();
  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;

  const resp = await generateText({
    system: `${systemPrompt}`,
    prompt: getParentAndChildrenPrompt(childrenHTML, childrenCSS, JSON.stringify(parentNode)),
    model: provider.getModelInstance({
      model: currentModel,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
  });

  const response = resp.text;
  logger.debug('3. Parent Node String Length:', parentNodeString.length, 'response: ' ,  response, );
  // logger.debug('Response:', response);
  const htmlMatch = response.match(/<html-block>([\s\S]*?)<\/html-block>/);
  const cssMatch = response.match(/<css-block>([\s\S]*?)<\/css-block>/);

  const html = htmlMatch ? htmlMatch[1].trim() : '';
  const css = cssMatch ? cssMatch[1].trim() : '';
  return { html, css };
}


export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  return filePaths;
}

//write a function that takes 2 param that are content of html and css and returns a prompt to
//genAI know that is html and css of children of parent node json
export function getChildrenPrompt(html: string, css: string) {
  //if html and css is empty then return empty string
  if (!html && !css) {
    return '';
  }
  return `Below is the HTML and CSS of the children of the parent node JSON.
  HTML: ${html}
  CSS: ${css}`;
}

//write a function that take content of parent json node and return a prompt to genAI
//genAI know that is parent node json
export function getParentPrompt(parentJson: string) {
  //if parent json is empty then return empty string
  if (!parentJson) {
    return '';
  }
  return `Below is the JSON of the parent node.
  JSON: ${parentJson}`;
}

//write a function use get childrenPrompt and getParentPrompt to create a prompt
//that genAI know that is parent node json and children html and css
export function getParentAndChildrenPrompt(html: string, css: string, parentJson: string) {
  const childrenPrompt = getChildrenPrompt(html, css);
  const parentPrompt = getParentPrompt(parentJson);
  return `${childrenPrompt} ${parentPrompt}`;
}
