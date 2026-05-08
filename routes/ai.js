const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper for exponential backoff with smarter error handling
const withExponentialBackoff = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const status = error.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      
      if (i < retries - 1) {
        console.warn(`Retrying due to API error: ${error.message}. Attempt ${i + 1}/${retries}. Waiting ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

// Nigerian states
const nigerianStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", 
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", 
  "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", 
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", 
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", 
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

// Local knowledge base for common questions
const localKnowledge = {
  "who are you": "I'm Chappie, your AI personal assistant! How can I help you today?",
  "what can you do": "I can answer questions, provide weather forecasts, give directions, and help with various tasks.",
  "who created you": "I was created by Stephen Okwu Chidi, a brilliant developer passionate about AI.",
  "nigerian states": `Nigeria has 36 states: ${nigerianStates.join(', ')}.`,
  "states in nigeria": `Nigeria has 36 states: ${nigerianStates.join(', ')}.`,
  "hello": "Hello! How can I assist you today?",
  "hey": "Hey there! What can I do for you?",
  "how are you": "I'm functioning perfectly, thanks for asking! How can I help you?",
  "weather": "Please specify a location for weather information, e.g. 'weather in Lagos'",
  "directions": "Please specify a destination, e.g. 'directions to Abuja'",
  "creator": "I was developed by Stephen Okwu Chidi, a talented software engineer.",
  "who made you": "I was created by Stephen Okwu Chidi, who's passionate about building helpful AI systems."
};

// Get coordinates from location using Nominatim (global, no country restriction)
const getCoordinates = async (location) => {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: { 
        q: location, 
        format: 'json', 
        limit: 1
      },
      headers: { 'User-Agent': 'ChappieAI/1.0' }
    });
    
    if (response.data.length > 0) {
      return { 
        lat: parseFloat(response.data[0].lat), 
        lon: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

// Get weather data using Open-Meteo (global)
const getWeather = async (location) => {
  const coords = await getCoordinates(location);
  if (!coords) return `Couldn't find location ${location}`;
  
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: coords.lat,
        longitude: coords.lon,
        current: 'temperature_2m,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        timezone: 'auto'
      }
    });
    
    const current = response.data.current;
    const daily = response.data.daily;
    
    // Weather code descriptions
    const weatherCodes = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'fog',
      51: 'light drizzle',
      61: 'light rain',
      80: 'light rain showers'
    };
    
    const condition = weatherCodes[current.weather_code] || 'unknown conditions';
    
    return `Current weather in ${coords.displayName}: ${current.temperature_2m}°C, ${condition}. ` +
           `Today: High ${daily.temperature_2m_max[0]}°C, Low ${daily.temperature_2m_min[0]}°C`;
  } catch (error) {
    console.error('Weather API error:', error.message);
    return `Couldn't retrieve weather for ${location}`;
  }
};

// Gemini API call with updated model name for 2025 (gemini-2.5-pro)
const callGemini = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) return null;
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await withExponentialBackoff(() => 
      axios.post(url, {
        contents: [{
          role: "user",
          parts: [{text: prompt}]
        }]
      }, {
        headers: {'Content-Type': 'application/json'}
      })
    );
    
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Gemini error:', error.response?.data || error.message);
    return null;
  }
};

// OpenAI API call with gpt-3.5-turbo
const callOpenAI = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) return null;
  
  try {
    const response = await withExponentialBackoff(() => 
      axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{role: 'user', content: prompt}],
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
    );
    
    return response.data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI error:', error.response?.data || error.message);
    return null;
  }
};

// Wolfram Alpha API call for factual queries
const callWolframAlpha = async (prompt) => {
  if (!process.env.WOLFRAM_ALPHA_APPID) return null;
  
  try {
    const response = await withExponentialBackoff(() => 
      axios.get('http://api.wolframalpha.com/v1/result', {
        params: {
          appid: process.env.WOLFRAM_ALPHA_APPID,
          i: encodeURIComponent(prompt)
        }
      })
    );
    
    return response.data || null;
  } catch (error) {
    console.error('Wolfram Alpha error:', error.response?.data || error.message);
    return null;
  }
};

// Google Custom Search API as final fallback
const callGoogleSearch = async (prompt) => {
  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) return null;
  
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(prompt)}`;
    
    const response = await withExponentialBackoff(() => axios.get(url));
    const items = response.data.items || [];
    
    if (items.length > 0) {
      return items.slice(0, 3).map(item => 
        `${item.title}: ${item.snippet} (${item.link})`
      ).join('\n\n');
    }
    return null;
  } catch (error) {
    console.error('Google Search error:', error.response?.data || error.message);
    return null;
  }
};

// Main router handler
router.post('/query', async (req, res) => {
  const { prompt, userId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  const lowerPrompt = prompt.toLowerCase();
  
  // 1. First check local knowledge base
  for (const [keyword, response] of Object.entries(localKnowledge)) {
    if (lowerPrompt.includes(keyword)) {
      return res.json({ response });
    }
  }
  
  // 2. Handle weather requests (global)
  if (lowerPrompt.includes('weather') || lowerPrompt.includes('forecast')) {
    const locationMatch = lowerPrompt.match(/(?:in|for|at) (.+?)(?: today| tomorrow|$)/i);
    const location = locationMatch ? locationMatch[1].trim() : "Lagos, Nigeria";
    const response = await getWeather(location);
    return res.json({ response });
  }
  
  // 3. Handle Nigerian states request
  if (lowerPrompt.includes('nigerian states') || lowerPrompt.includes('states in nigeria')) {
    const response = `Nigeria has 36 states: ${nigerianStates.join(', ')}.`;
    return res.json({ response });
  }
  
  // 4. Handle creator information
  if (lowerPrompt.includes('creator') || lowerPrompt.includes('who made you')) {
    return res.json({ response: "I was created by Stephen Okwu Chidi, a brilliant developer passionate about AI innovation." });
  }
  
  // 5. Handle personal information
  if (lowerPrompt.includes('who are you') || lowerPrompt.includes('your name')) {
    return res.json({ response: "I'm Chappie, your AI personal assistant. How can I help you today?" });
  }
  
  // 6. Try external APIs in sequence
  let aiResponse = null;
  const apiSequence = [
    () => callGemini(prompt),
    () => callOpenAI(prompt),
    () => callWolframAlpha(prompt),
    () => callGoogleSearch(prompt)
  ];
  
  for (const apiCall of apiSequence) {
    aiResponse = await apiCall();
    if (aiResponse) break;
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between APIs
  }
  
  // 7. Final fallback
  if (!aiResponse) {
    const fallbacks = [
      "I'm still learning. Could you rephrase that?",
      "I'm not sure how to respond to that yet.",
      "That's an interesting question. I'll need to learn more about that.",
      "I don't have information on that at the moment."
    ];
    aiResponse = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  return res.json({ response: aiResponse });
});

module.exports = router;