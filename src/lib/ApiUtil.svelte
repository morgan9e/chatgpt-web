<script context="module" lang="ts">
  import { persisted } from 'svelte-local-storage-store'
  import { get } from 'svelte/store'
  // This makes it possible to override the OpenAI API base URL in the .env file
  const apiBaseStorage = persisted('apiBase', 'https://api.openai.com')

  const apiBase = get(apiBaseStorage) || 'https://api.openai.com'
  const endpointCompletions = import.meta.env.VITE_ENDPOINT_COMPLETIONS || '/v1/chat/completions'
  const endpointGenerations = import.meta.env.VITE_ENDPOINT_GENERATIONS || '/v1/images/generations'
  const endpointModels = import.meta.env.VITE_ENDPOINT_MODELS || '/v1/models'
  const endpointEmbeddings = import.meta.env.VITE_ENDPOINT_EMBEDDINGS || '/v1/embeddings'

  export const setApiBase = (e: string) => {
    console.log(e)
    apiBaseStorage.set(e || '')
  }
  export const getApiBase = ():string => apiBase
  export const getEndpointCompletions = ():string => endpointCompletions
  export const getEndpointGenerations = ():string => endpointGenerations
  export const getEndpointModels = ():string => endpointModels
  export const getEndpointEmbeddings = ():string => endpointEmbeddings
</script>