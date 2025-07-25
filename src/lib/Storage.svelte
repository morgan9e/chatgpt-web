<script context="module" lang="ts">
  import { persisted } from 'svelte-local-storage-store'
  import { get, writable } from 'svelte/store'
  import type { Chat, ChatSettings, GlobalSettings, Message, ChatSetting, GlobalSetting, Usage, Model, ChatSortOption } from './Types.svelte'
  import { getChatSettingObjectByKey, getGlobalSettingObjectByKey, getChatDefaults, getExcludeFromProfile, chatSortOptions, globalDefaults } from './Settings.svelte'
  import { v4 as uuidv4 } from 'uuid'
  import { getProfile, getProfiles, isStaticProfile, newNameForProfile, restartProfile } from './Profiles.svelte'
  import { errorNotice, generateShortId } from './Util.svelte'
  import { clearAllImages, deleteImage, setImage } from './ImageStore.svelte'

  // TODO: move chatsStorage to indexedDB with localStorage as a fallback for private browsing.
  //       Enough long chats will overflow localStorage.
  export const chatsStorage = persisted('chats', [] as Chat[])
  export const latestModelMap = persisted('latestModelMap', {} as Record<Model, Model>) // What was returned when a model was requested
  export const globalStorage = persisted('global', {} as GlobalSettings)
  const apiKeyFromEnv = import.meta.env.VITE_OPENAI_API_KEY || ''
  export const apiKeyStorage = persisted('apiKey', apiKeyFromEnv as string)
  export let checkStateChange = writable(0) // Trigger for Chat
  export let showSetChatSettings = writable(false) //
  export let submitExitingPromptsNow = writable(false) // for them to go now.  Will not submit anything in the input
  export let pinMainMenu = writable(false) // Show menu (for mobile use)
  export let continueMessage = writable('') //
  export let currentChatMessages = writable([] as Message[])
  export let started = writable(false)
  export let currentChatId = writable('')
  export let lastChatId = persisted('lastChatId', '')

  const chatDefaults = getChatDefaults()
  
  export const getApiKey = (): string => {
    return get(apiKeyStorage)
  }

  export const newChatID = (): string => {
    return generateShortId()
  }

  export const addChat = (profile:ChatSettings|undefined = undefined): string => {
    const chats = get(chatsStorage)

    // Generate new short UUID
    const chatId = newChatID()

    profile = JSON.parse(JSON.stringify(profile || getProfile(''))) as ChatSettings

    // Add a new chat
    chats.push({
      id: chatId,
      name: `New Chat`,
      settings: profile,
      messages: [],
      usage: {} as Record<Model, Usage>,
      startSession: false,
      sessionStarted: false,
      created: Date.now(),
      lastUse: Date.now(),
      lastAccess: Date.now()
    })
    chatsStorage.set(chats)
    // Apply defaults and prepare it to start
    restartProfile(chatId)
    return chatId
  }

  export const addChatFromJSON = async (json: string): Promise<string> => {
    const chats = get(chatsStorage)

    // Find the max chatId
    const chatId = newChatID()

    let chat: Chat
    try {
      chat = JSON.parse(json) as Chat
      if (!chat.settings || !chat.messages || !chat.id) {
        errorNotice('Not valid Chat JSON')
        return ''
      }
    } catch (err) {
      errorNotice("Can't parse file JSON")
      return ''
    }

    chat.id = chatId
    chat.created = Date.now()

    // Make sure images are moved to indexedDB store,
    // else they would clobber local storage
    await updateChatImages(chatId, chat)

    // Add a new chat
    chats.push(chat)
    chatsStorage.set(chats)
    // make sure it's up-to-date
    updateChatSettings(chatId)
    return chatId
  }

  // Make sure a chat's settings are set with current values or defaults
  export const updateChatSettings = (chatId:string) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    if (!chat.settings) {
      chat.settings = {} as ChatSettings
    }
    updateProfile(chat.settings, false)
    // make sure old chat messages have UUID
    chat.messages.forEach((m) => {
      m.uuid = m.uuid || uuidv4()
      delete m.streaming
    })
    // Make sure the usage totals object is set
    // (some earlier versions of this had different structures)
    const hasUsage = chat.usage && !Array.isArray(chat.usage) &&
      typeof chat.usage === 'object' &&
      Object.values(chat.usage).find(v => 'prompt_tokens' in v)
    if (!hasUsage) {
      const usageMap:Record<Model, Usage> = {}
      chat.usage = usageMap
    }
    if (chat.startSession === undefined) chat.startSession = false
    if (chat.sessionStarted === undefined) chat.sessionStarted = !!chat.messages.find(m => m.role === 'user')
    chatsStorage.set(chats)
  }

  // Make sure profile options are set with current values or defaults
  export const updateProfile = (profile:ChatSettings, exclude:boolean):ChatSettings => {
    Object.entries(getChatDefaults()).forEach(([k, v]) => {
      const val = profile[k]
      profile[k] = (val === undefined || val === null ? v : profile[k])
    })
    // update old useSummarization to continuousChat mode setting
    if ('useSummarization' in profile || !('continuousChat' in profile)) {
      const usm = profile.useSummarization
      if (usm && !profile.summaryPrompt) {
        profile.continuousChat = 'fifo'
      } else if (usm) {
        profile.continuousChat = 'summary'
      } else {
        profile.continuousChat = ''
      }
      delete profile.useSummarization
    }
    if (exclude) {
      Object.keys(getExcludeFromProfile()).forEach(k => {
        delete profile[k]
      })
    }
    return profile
  }
  
  // Reset all setting to current profile defaults
  export const resetChatSettings = (chatId: string, resetAll:boolean = false) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    const profile = getProfile(chat.settings.profile)
    const exclude = getExcludeFromProfile()
    if (resetAll) {
      // Reset to base defaults first, then apply profile
      Object.entries(getChatDefaults()).forEach(([k, v]) => {
        chat.settings[k] = v
      })
    }
    Object.entries(profile).forEach(([k, v]) => {
      if (exclude[k]) return
      chat.settings[k] = v
    })
    chatsStorage.set(chats)
  }

  export const clearChats = () => {
    chatsStorage.set([])
    clearAllImages()
  }
  export const saveChatStore = () => {
    const chats = get(chatsStorage)
    chatsStorage.set(chats)
  }

  export const getChat = (chatId: string):Chat => {
    const chats = get(chatsStorage)
    return chats.find((chat) => chat.id === chatId) as Chat
  }

  export const getChatSettings = (chatId: string):ChatSettings => {
    const chats = get(chatsStorage)
    return (chats.find((chat) => chat.id === chatId) as Chat).settings
  }

  export const updateRunningTotal = (chatId: string, usage: Usage, model:Model) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    let total:Usage = chat.usage[model]
    if (!total) {
      total = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
      chat.usage[model] = total
    }
    total.completion_tokens += usage?.completion_tokens || 0
    total.prompt_tokens += usage?.prompt_tokens || 0
    total.total_tokens += usage?.total_tokens || 0
    chatsStorage.set(chats)
  }

  export const subtractRunningTotal = (chatId: string, usage: Usage, model:Model) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    let total:Usage = chat.usage[model]
    if (!total) {
      total = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
      chat.usage[model] = total
    }
    total.completion_tokens -= usage?.completion_tokens || 0
    total.prompt_tokens -= usage?.prompt_tokens || 0
    total.total_tokens -= usage?.total_tokens || 0
    chatsStorage.set(chats)
  }

  export const getMessages = (chatId: string): Message[] => {
    if (get(currentChatId) === chatId) return get(currentChatMessages)
    return getChat(chatId).messages
  }

  let setChatTimer: any
  export const setCurrentChat = (chatId: string) => {
    clearTimeout(setChatTimer)
    if (!chatId) {
      currentChatId.set('')
      lastChatId.set('')
      currentChatMessages.set([])
      return
    }
    setChatTimer = setTimeout(() => {
      currentChatId.set(chatId)
      lastChatId.set(chatId)
      currentChatMessages.set(getChat(chatId).messages)
    }, 10)
  }

  const signalChangeTimers = new Map<string, any>()
  const setChatLastUse = (chatId: string, time: number) => {
    const existingTimer = signalChangeTimers.get(chatId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    const timer = setTimeout(() => {
      getChat(chatId).lastUse = time
      saveChatStore()
      signalChangeTimers.delete(chatId)
    }, 500)
    signalChangeTimers.set(chatId, timer)
  }

  const setMessagesTimers = new Map<string, any>()
  export const setMessages = (chatId: string, messages: Message[]) => {
    if (get(currentChatId) === chatId) {
      // update current message cache right away
      currentChatMessages.set(messages)
      const existingTimer = setMessagesTimers.get(chatId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      // delay expensive all chats update for a bit
      const timer = setTimeout(() => {
        getChat(chatId).messages = messages
        saveChatStore()
        setChatLastUse(chatId, Date.now())
        setMessagesTimers.delete(chatId)
      }, 200)
      setMessagesTimers.set(chatId, timer)
    } else {
      const existingTimer = setMessagesTimers.get(chatId)
      if (existingTimer) {
        clearTimeout(existingTimer)
        setMessagesTimers.delete(chatId)
      }
      getChat(chatId).messages = messages
      saveChatStore()
      setChatLastUse(chatId, Date.now())
    }
  }

  export const updateMessages = (chatId: string) => {
    setMessages(chatId, getMessages(chatId))
  }

  // Cleanup function to clear all timers and prevent memory leaks
  export const clearAllTimers = () => {
    if (setChatTimer) {
      clearTimeout(setChatTimer)
      setChatTimer = null
    }
    
    signalChangeTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    signalChangeTimers.clear()
    
    setMessagesTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    setMessagesTimers.clear()
  }

  export const addError = (chatId: string, error: string) => {
    addMessage(chatId, { content: error } as Message)
  }

  export const addMessage = (chatId: string, message: Message) => {
    const messages = getMessages(chatId)
    if (!message.uuid) message.uuid = uuidv4()
    if (!message.created) message.created = Date.now()
    if (messages.indexOf(message) < 0) {
      // Don't have message, add it
      messages[messages.length] = message
    }
    setMessages(chatId, messages)
  }

  export const getMessage = (chatId: string, uuid:string):Message|undefined => {
    return getMessages(chatId).find((m) => m.uuid === uuid)
  }

  export const insertMessages = (chatId: string, insertAfter: Message, newMessages: Message[]) => {
    const messages = getMessages(chatId)
    const index = messages.findIndex((m) => m.uuid === insertAfter.uuid)
    if (index === undefined || index < 0) {
      console.error("Couldn't insert after message:", insertAfter)
      return
    }
    newMessages.forEach(m => {
      m.uuid = m.uuid || uuidv4()
      m.created = m.created || Date.now()
    })
    messages.splice(index + 1, 0, ...newMessages)
    setMessages(chatId, messages.filter(m => true))
  }

  export const deleteSummaryMessage = (chatId: string, uuid: string) => {
    const message = getMessage(chatId, uuid)
    if (message && message.summarized) throw new Error('Unable to delete summarized message')
    if (message && message.summary) { // messages we summarized
      message.summary.forEach(sid => {
        const m = getMessage(chatId, sid)
        if (m) {
          delete m.summarized // unbind to this summary
        }
      })
      delete message.summary
    }
    updateMessages(chatId)
    deleteMessage(chatId, uuid)
  }

  export const deleteMessage = (chatId: string, uuid: string) => {
    const messages = getMessages(chatId)
    const index = messages.findIndex((m) => m.uuid === uuid)
    const message = getMessage(chatId, uuid)
    if (message?.summarized) throw new Error('Unable to delete summarized message')
    if (message?.summary) throw new Error('Unable to directly delete message summary')
    if (index < 0) {
      console.error(`Unable to find and delete message with ID: ${uuid}`)
      return
    }
    if (message?.image) {
      deleteImage(chatId, message.image.id)
    }
    // console.warn(`Deleting message with ID: ${uuid}`, found, index)
    messages.splice(index, 1) // remove item
    setMessages(chatId, messages.filter(m => true))
  }

  const clearImages = (chatId: string, messages: Message[]) => {
    messages.forEach(m => {
      if (m.image) deleteImage(chatId, m.image.id)
    })
  }

  export const truncateFromMessage = (chatId: string, uuid: string) => {
    const messages = getMessages(chatId)
    const index = messages.findIndex((m) => m.uuid === uuid)
    const message = getMessage(chatId, uuid)
    if (message && message.summarized) throw new Error('Unable to truncate from a summarized message')
    if (index < 0) {
      throw new Error(`Unable to find message with ID: ${uuid}`)
    }
    const truncated = messages.splice(index + 1) // remove every item after
    clearImages(chatId, truncated)
    setMessages(chatId, messages.filter(m => true))
  }

  export const clearMessages = (chatId: string) => {
    clearImages(chatId, getMessages(chatId))
    setMessages(chatId, [])
  }

  export const deleteChat = (chatId: string) => {
    const chats = get(chatsStorage)
    clearImages(chatId, getMessages(chatId) || [])
    chatsStorage.set(chats.filter((chat) => chat.id !== chatId))
  }

  export const updateChatImages = async (chatId: string, chat: Chat) => {
    const messages = chat.messages
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (m.image) m.image = await setImage(chatId, m.image)
    }
  }

  export const copyChat = async (chatId: string) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    const nameMap = chats.reduce((a, chat) => { a[chat.name] = chat; return a }, {})
    const cname = newName(chat.name, nameMap)
    const chatCopy = JSON.parse(JSON.stringify(chat))

    // Set the ID
    chatCopy.id = newChatID()
    chatCopy.created = Date.now()
    // Set new name
    chatCopy.name = cname

    await updateChatImages(chatId, chatCopy)

    // Add a new chat
    chats.push(chatCopy)
  
    // chatsStorage
    chatsStorage.set(chats)
  }

  export const cleanSettingValue = (type:string, value: any) => {
    switch (type) {
      case 'number':
      case 'select-number':
        value = parseFloat(value)
        if (isNaN(value)) { value = null }
        return value
      case 'boolean':
        if (typeof value === 'string') value = value.trim().toLocaleLowerCase()
        return value === 'true' || value === 'yes' || (value ? value !== 'false' && value !== 'no' && !!value : false)
      default:
        return value
    }
  }
  
  export const setChatSettingValueByKey = (chatId: string, key: keyof ChatSettings, value) => {
    const setting = getChatSettingObjectByKey(key)
    if (setting) return setChatSettingValue(chatId, setting, value)
    if (!(key in chatDefaults)) throw new Error('Invalid chat setting: ' + key)
    const d = chatDefaults[key]
    if (d === null || d === undefined) {
      throw new Error('Unable to determine setting type for "' +
      key + ' from default of "' + d + '"')
    }
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    const settings = chat.settings as any
    settings[key] = cleanSettingValue(typeof d, value)
  }

  export const setChatSettingValue = (chatId: string, setting: ChatSetting, value) => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    let settings = chat.settings as any
    if (!settings) {
      settings = {} as ChatSettings
      chat.settings = settings
    }
    settings[setting.key] = cleanSettingValue(setting.type, value)
    chatsStorage.set(chats)
  }

  export const getChatSettingValueNullDefault = (chatId: string, setting: ChatSetting):any => {
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    let value = chat.settings && chat.settings[setting.key]
    value = (value === undefined) ? null : value
    if (!setting.forceApi && value === chatDefaults[setting.key]) value = null
    return value
  }
  
  export const setGlobalSettingValueByKey = (key: keyof GlobalSettings, value) => {
    return setGlobalSettingValue(getGlobalSettingObjectByKey(key), value)
  }

  export const setGlobalSettingValue = (setting: GlobalSetting, value) => {
    const store = get(globalStorage)
    store[setting.key as any] = cleanSettingValue(setting.type, value)
    globalStorage.set(store)
  }

  
  export const getGlobalSettingValue = (key:keyof GlobalSetting, value):any => {
    const store = get(globalStorage)
    return store[key]
  }

  export const getGlobalSettings = ():GlobalSettings => {
    return get(globalStorage)
  }

  export const getCustomProfiles = ():Record<string, ChatSettings> => {
    const store = get(globalStorage)
    return store.profiles || {}
  }

  export const deleteCustomProfile = (chatId:string, profileId:string) => {
    if (isStaticProfile(profileId)) {
      throw new Error('Sorry, you can\'t delete a static profile.')
    }
    const chats = get(chatsStorage)
    const chat = chats.find((chat) => chat.id === chatId) as Chat
    const store = get(globalStorage)
    if (store.defaultProfile === chat.settings.profile) {
      throw new Error('Sorry, you can\'t delete the default profile.')
    }
    delete store.profiles[profileId]
    globalStorage.set(store)
    getProfiles(true) // force update profile cache
  }

  export const saveCustomProfile = (profile:ChatSettings) => {
    const store = get(globalStorage)
    let profiles = store.profiles
    if (!profiles) {
      profiles = {}
      store.profiles = profiles
    }
    if (!profile.profile) profile.profile = uuidv4()
    const mt = profile.profileName && profile.profileName.trim().toLocaleLowerCase()
    const sameTitle = Object.values(profiles).find(c => c.profile !== profile.profile &&
    c.profileName && c.profileName.trim().toLocaleLowerCase() === mt)
    if (sameTitle) {
      throw new Error(`Sorry, another profile already exists with the name "${profile.profileName}"`)
    }
    if (!mt) {
      throw new Error('Sorry, you need to enter a valid name for your profile.')
    }
    if (!profile.characterName || profile.characterName.length < 3) {
      throw new Error('Your profile\'s character needs a valid name.')
    }
    if (isStaticProfile(profile.profile)) {
      // throw new Error('Sorry, you can\'t modify a static profile. You can clone it though!')
      // Save static profile as new custom
      profile.profileName = newNameForProfile(profile.profileName)
      profile.profile = uuidv4()
    }
    const clone = JSON.parse(JSON.stringify(profile)) // Always store a copy
    // pull excluded
    Object.keys(getExcludeFromProfile()).forEach(k => {
      delete clone[k]
    })
    // pull defaults
    // Object.entries(getChatDefaults()).forEach(([k, v]) => {
    //   if (clone[k] === v || (v === undefined && clone[k] === null)) delete clone[k]
    // })
    profiles[profile.profile as string] = clone
    globalStorage.set(store)
    profile.isDirty = false
    saveChatStore()
    getProfiles(true) // force update profile cache
  }

  export const getChatSortOption = (): ChatSortOption => {
    const store = get(globalStorage)
    return (chatSortOptions[store.chatSort] || chatSortOptions[globalDefaults.chatSort])
  }

  export const setChatSortOption = (sortName: any) => {
    const store = get(globalStorage)
    store.chatSort = chatSortOptions[sortName] ? sortName : globalDefaults.chatSort
    globalStorage.set(store)
    checkStateChange.set(get(checkStateChange) + 1)
  }

  export const newName = (name:string, nameMap:Record<string, any>):string => {
    if (!nameMap[name]) return name
    const nm = name.match(/^(.*[^0-9]+)([- ])*([0-9]+)$/)
    let i:number = 1
    let s = ' '
    if (nm) {
      name = nm[1]
      s = nm[2] || ''
      i = parseInt(nm[3])
    }
    let cname = `${name}${s}${i}`
    while (nameMap[cname]) {
      i++
      cname = `${name}${s}${i}`
    }
    return cname
  }

  export const getLatestKnownModel = (model:Model) => {
    const modelMapStore = get(latestModelMap)
    return modelMapStore[model] || model
  }

  
  export const setLatestKnownModel = (requestedModel:Model, responseModel:Model) => {
    const modelMapStore = get(latestModelMap)
    modelMapStore[requestedModel] = responseModel
    latestModelMap.set(modelMapStore)
  }
  
  export const dumpLocalStorage = () => {
    try {
      const storageObject: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storageObject[key] = localStorage.getItem(key);
        }
      }

      const dataStr = JSON.stringify(storageObject, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/:\d+\.\d+Z$/, '').replace(/-|:/g, '_');
      link.download = `ChatGPT-web-${dateTimeStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error dumping localStorage:', error);
    }
  };

  export const loadLocalStorage = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.addEventListener('change', function (e) {
      const input = e.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          if (!e.target) return;
          const data = JSON.parse(e.target.result as string);
          Object.keys(data).forEach(function (key) {
            localStorage.setItem(key, data[key]);
          });
          window.location.reload();
        };
        reader.readAsText(file);
      }
    });
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

</script>
