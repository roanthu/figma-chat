
function extractFigmaDetails(url: string): { fileKey: string, nodeId: string } | null {
    const regex = /https:\/\/www\.figma\.com\/design\/([^\/]+)\/[^?]+\?node-id=([^&]+)&?/;
    const match = url.match(regex);
    
    if (match) {
        const fileKey = match[1];
        const nodeId = match[2];
        return { fileKey, nodeId };
    }
    
    return null;
}

// Example usage
const url = 'https://www.figma.com/design/abcd1234/MarginX-(Copy)?node-id=node5678&t=sUZvqR7p1bpnF0C5-4';
const details = extractFigmaDetails(url);
console.log(details); // { fileKey: 'abcd1234', nodeId: 'node5678' }
