import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle form submission or API request
    if (request.method === 'POST') {
      const formData = await request.formData();
      const urlToCheck = formData.get('url') || '';
      
      return await analyzeUrl(urlToCheck, env);
    }
    
    // Return the UI for GET requests
    return new Response(generateHtml(), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
};

async function analyzeUrl(urlToCheck, env) {
  // Initialize AI
  const ai = new Ai(env.AI);
  
  // Prompt engineering for URL analysis
  const prompt = `
    Analyze this URL: "${urlToCheck}"
    
    Identify if it shows signs of being a phishing attempt based on:
    1. Suspicious domain structure (typosquatting, misleading names)
    2. Unusual URL patterns (excessive subdomains, random strings)
    3. Presence of brand names in unexpected domains
    4. Deceptive paths or query parameters
    
    Rate the phishing probability from 1-10 and explain your reasoning.
    Format your response as JSON with fields: 
    {
      "score": number,
      "risk_level": "low|medium|high",
      "reasoning": "string",
      "recommendations": "string"
    }
  `;

  try {
    // Call the model
    //const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
    const response = await env.AI.run('@hf/thebloke/deepseek-coder-6.7b-base-awq', {
      messages: [
        { role: 'system', content: 'You are a cybersecurity expert specializing in URL analysis.' },
        { role: 'user', content: prompt }
      ]
    });
    
    // Parse the model response
    const analysisText = response.response;
    let analysis;
    
    try {
      // Extract JSON from the text response
      const jsonMatch = analysisText.match(/```json([\s\S]*?)```/) || 
                        analysisText.match(/{[\s\S]*}/);
      
      const jsonString = jsonMatch ? 
        (jsonMatch[1] ? jsonMatch[1].trim() : jsonMatch[0]) : 
        analysisText;
        
      analysis = JSON.parse(jsonString);
    } catch (e) {
      // Fallback if JSON parsing fails
      analysis = {
        score: 5,
        risk_level: "medium",
        reasoning: "Could not parse structured analysis. Original response: " + analysisText,
        recommendations: "Please review the URL manually."
      };
    }

    // Generate response HTML
    const resultHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Phishing URL Analysis</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            .result { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px; }
            .high { border-left: 5px solid #ff4d4d; }
            .medium { border-left: 5px solid #ffcc00; }
            .low { border-left: 5px solid #66cc66; }
            h2 { margin-top: 0; }
            .score { font-size: 24px; font-weight: bold; }
            a.back { display: inline-block; margin-top: 20px; color: #0066cc; text-decoration: none; }
            a.back:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>Phishing URL Analysis</h1>
          <p>Analysis for: <code>${urlToCheck}</code></p>
          
          <div class="result ${analysis.risk_level}">
            <h2>Risk Assessment</h2>
            <p class="score">Score: ${analysis.score}/10 (${analysis.risk_level.toUpperCase()} RISK)</p>
            <h3>Reasoning:</h3>
            <p>${analysis.reasoning}</p>
            <h3>Recommendations:</h3>
            <p>${analysis.recommendations}</p>
          </div>
          
          <a href="/" class="back">← Analyze another URL</a>
        </body>
      </html>
    `;
    
    return new Response(resultHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Error analyzing URL: ${error.message}`, { status: 500 });
  }
}

function generateHtml() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Phishing URL Detector</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          form { margin-top: 20px; }
          input[type="text"] { width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { background-color: #0051c3; color: white; border: none; padding: 10px 15px; font-size: 16px; border-radius: 4px; cursor: pointer; margin-top: 10px; }
          button:hover { background-color: #003da0; }
          .examples { margin-top: 30px; }
          .example { cursor: pointer; color: #0066cc; margin-right: 15px; }
          .example:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Phishing URL Detector</h1>
        <p>Enter a URL to analyze for potential phishing indicators using Cloudflare Workers AI.</p>
        
        <form method="POST">
          <input type="text" name="url" placeholder="Enter URL to analyze" required>
          <button type="submit">Analyze URL</button>
        </form>
        
<div class="examples">
  <p>Examples to try:</p>
  <span class="example">
    <a href="#" onclick="document.querySelector('input[name=url]').value='https://secure-bankofamerica.com.phishing.example/login'">
      Banking phishing example
    </a>
  </span>
  <span class="example">
    <a href="#" onclick="document.querySelector('input[name=url]').value='https://www.sherilnagoor.com'">
      Legitimate URL example
    </a>
  </span>
</div>

      </body>
    </html>
  `;
}

