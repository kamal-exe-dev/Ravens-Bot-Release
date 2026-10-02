const { GoogleGenerativeAI } = require('@google/generative-ai');
const discordTools = require('./discordTools');
const serverContext = require('./serverContext');
const config = require('../config/botConfig');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

let genAI;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

async function sendWithRetry(chat, message) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await chat.sendMessage(message);
    } catch (err) {
      const status = err.status || err.httpStatusCode;
      const retryable = status === 503 || status === 429 || status === 500;
      if (!retryable || attempt === MAX_RETRIES) throw err;
      const delay = RETRY_DELAYS[attempt] || 5000;
      console.log(`Gemini ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function convertSchema(schema) {
  if (!schema || !schema.type) return undefined;

  const result = {};

  switch (schema.type) {
    case 'object':
      result.type = 'OBJECT';
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        result.properties = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          result.properties[key] = convertSchema(value);
        }
      }
      if (schema.required) result.required = schema.required;
      break;
    case 'string':
      result.type = 'STRING';
      if (schema.description) result.description = schema.description;
      if (schema.enum) result.enum = schema.enum;
      break;
    case 'number':
    case 'integer':
      result.type = 'NUMBER';
      if (schema.description) result.description = schema.description;
      break;
    case 'boolean':
      result.type = 'BOOLEAN';
      if (schema.description) result.description = schema.description;
      break;
    case 'array':
      result.type = 'ARRAY';
      if (schema.items) result.items = convertSchema(schema.items);
      if (schema.description) result.description = schema.description;
      break;
  }

  return result;
}

function convertTools(anthropicTools) {
  return anthropicTools.map(tool => {
    const decl = {
      name: tool.name,
      description: tool.description,
    };
    const params = convertSchema(tool.input_schema);
    if (params && params.properties && Object.keys(params.properties).length > 0) {
      decl.parameters = params;
    }
    return decl;
  });
}

async function processRequest(prompt, guild, member, options = {}) {
  const context = serverContext.build(guild);
  const systemPrompt = serverContext.buildSystemPrompt(context);
  const geminiTools = convertTools(discordTools.definitions);

  const modelIds = [config.ai.model, config.ai.fallbackModel].filter(Boolean);
  let chat;
  let result;
  let response;
  const messageText = prompt || 'The user has confirmed. Please proceed with the planned actions now.';

  for (const modelId of modelIds) {
    try {
      const model = getClient().getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: geminiTools }],
      });
      chat = model.startChat({ history: options.history || [] });
      result = await sendWithRetry(chat, messageText);
      response = result.response;
      console.log(`Using model: ${modelId}`);
      break;
    } catch (err) {
      console.log(`Model ${modelId} failed: ${err.status || ''} ${err.message?.slice(0, 60)}`);
      if (modelId === modelIds[modelIds.length - 1]) throw err;
    }
  }

  const actionLog = [];
  const pendingConfirmations = [];
  let toolCalls = 0;

  while (toolCalls < config.ai.maxToolCalls) {
    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    const functionResponses = [];

    for (const fc of functionCalls) {
      toolCalls++;

      if (toolCalls > config.ai.maxToolCalls) {
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: { success: false, error: 'Maximum tool call limit reached.' },
          },
        });
        continue;
      }

      const toolResult = await discordTools.executeTool(
        fc.name, fc.args || {}, guild, member, { confirmed: options.confirmed || false },
      );

      if (toolResult.needs_confirmation) {
        pendingConfirmations.push({ tool: fc.name, input: fc.args });
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: { success: false, error: 'This action requires user confirmation. Present your full plan to the user and ask them to confirm before proceeding.' },
          },
        });
      } else {
        actionLog.push({ tool: fc.name, input: fc.args, result: toolResult });
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: toolResult,
          },
        });
      }
    }

    result = await sendWithRetry(chat, functionResponses);
    response = result.response;
  }

  let text;
  try {
    text = response.text();
  } catch {
    text = 'Done.';
  }

  const history = await chat.getHistory();

  return {
    text,
    actionLog,
    pendingConfirmations,
    needsConfirmation: pendingConfirmations.length > 0,
    messages: history,
  };
}

async function continueAfterConfirmation(previousHistory, guild, member) {
  return processRequest(null, guild, member, {
    history: previousHistory,
    confirmed: true,
  });
}

module.exports = { processRequest, continueAfterConfirmation };
