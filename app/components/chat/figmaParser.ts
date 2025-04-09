//
//
// export async function processNode(figmaNode): Promise<string> {
//   let childrenHTML = '';
//
//   if (figmaNode.children && figmaNode.children.length > 0) {
//     const childHTMLs = await Promise.all(figmaNode.children.map(processNode));
//     childrenHTML = childHTMLs.join('\n');
//   }
//
//   const prompt = createPrompt(figmaNode, childrenHTML);
//   const html = await generateAngularCode(prompt);
//
//   return html.trim();
// }
