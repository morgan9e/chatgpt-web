<script context="module" lang="ts">

  import { getApiBase, getEndpointCompletions, getEndpointGenerations } from "../../ApiUtil.svelte";
  import { countTokens } from "../../Models.svelte";
  import { countMessageTokens } from "../../Stats.svelte";
  import { globalStorage } from "../../Storage.svelte";
  import type { Chat, Message, Model, ModelDetail } from "../../Types.svelte";
  import { chatRequest, imageRequest } from "./request.svelte";
  import { checkModel } from "./util.svelte";
  import { encode } from "gpt-tokenizer";
  import { get } from "svelte/store";
  import chatModelsJson from './models.json';

  const hiddenSettings = {
      startSequence: true,
      stopSequence: true,
      aggressiveStop: true,
      delimiter: true,
      userMessageStart: true,
      userMessageEnd: true,
      assistantMessageStart: true,
      assistantMessageEnd: true,
      systemMessageStart: true,
      systemMessageEnd: true,
      repetitionPenalty: true,
      holdSocket: true,
      // leadPrompt: true
  } as any;

  const chatModelBase = {
      type: "chat",
      help: 'Below are the settings that OpenAI allows to be changed for the API calls. See the <a target="_blank" href="https://platform.openai.com/docs/api-reference/chat/create">OpenAI API docs</a> for more details.',
      preFillMerge: (existingContent, newContent) => {
          if (existingContent && !newContent.match(/^('(t|ll|ve|m|d|re)[^a-z]|\s|[.,;:(_-{}*^%$#@!?+=~`[\]])/i)) {
              existingContent += " ";
          }
          return existingContent;
      },
      request: chatRequest,
      check: checkModel,
      getTokens: (value) => encode(value),
      getEndpoint: (model) => get(globalStorage).openAICompletionEndpoint || getApiBase() + getEndpointCompletions(),
      hideSetting: (chatId, setting) => !!hiddenSettings[setting.key],
      countMessageTokens: (message: Message, model: Model, chat: Chat) => {
          return countTokens(model, "## " + message.role + " ##:\r\n\r\n" + message.content + "\r\n\r\n\r\n");
      },
      countPromptTokens: (prompts: Message[], model: Model, chat: Chat): number => {
          return (
              prompts.reduce((a, m) => {  
                  a += countMessageTokens(m, model, chat);
                  return a;
              }, 0) + 3
          );
      },
  } as ModelDetail;

  export const chatModels: Record<string, ModelDetail> = {};

  for (const [key, { prompt, completion, max, reasoning, alias }] of Object.entries(chatModelsJson)) {
    chatModels[key] = {
      ...chatModelBase,
      prompt: prompt / 1_000_000,
      completion: completion / 1_000_000,
      max,
      ...(reasoning ? { reasoning } : {}),
      ...(alias ? { alias } : {}),
    };
  }

  const imageModelBase = {
      type: "image",
      prompt: 0.0,
      max: 1000, // 1000 char prompt, max
      request: imageRequest,
      check: checkModel,
      getTokens: (value) => [0],
      getEndpoint: (model) => getApiBase() + getEndpointGenerations(),
      hideSetting: (chatId, setting) => false,
  } as ModelDetail;

  export const imageModels: Record<string, ModelDetail> = {
      "dall-e-1024x1024": {
          ...imageModelBase,
          completion: 0.02, // $0.020 per image
          opt: {
              size: "1024x1024",
          },
      },
      "dall-e-512x512": {
          ...imageModelBase,
          completion: 0.018, // $0.018 per image
          opt: {
              size: "512x512",
          },
      },
      "dall-e-256x256": {
          ...imageModelBase,
          type: "image",
          completion: 0.016, // $0.016 per image
          opt: {
              size: "256x256",
          },
      },
      "dall-e-3-1024x1024": {
          ...imageModelBase,
          type: "image",
          completion: 0.04, // $0.040 per image
          opt: {
              model: "dall-e-3",
              size: "1024x1024",
          },
      },
      "dall-e-3-1024x1792-Portrait": {
          ...imageModelBase,
          type: "image",
          completion: 0.08, // $0.080 per image
          opt: {
              model: "dall-e-3",
              size: "1024x1792",
          },
      },
      "dall-e-3-1792x1024-Landscape": {
          ...imageModelBase,
          type: "image",
          completion: 0.08, // $0.080 per image
          opt: {
              model: "dall-e-3",
              size: "1792x1024",
          },
      },
      "dall-e-3-1024x1024-HD": {
          ...imageModelBase,
          type: "image",
          completion: 0.08, // $0.080 per image
          opt: {
              model: "dall-e-3",
              size: "1024x1024",
              quality: "hd",
          },
      },
      "dall-e-3-1024x1792-Portrait-HD": {
          ...imageModelBase,
          type: "image",
          completion: 0.12, // $0.080 per image
          opt: {
              model: "dall-e-3",
              size: "1024x1792",
              quality: "hd",
          },
      },
      "dall-e-3-1792x1024-Landscape-HD": {
          ...imageModelBase,
          type: "image",
          completion: 0.12, // $0.080 per image
          opt: {
              model: "dall-e-3",
              size: "1792x1024",
              quality: "hd",
          },
      },
  };

</script>