<script context="module" lang="ts">
  import { writable } from 'svelte/store'
  
  // Export sidebar collapse state so other components can react to it
  export const sidebarCollapsed = writable(false)
</script>

<script lang="ts">
  import { params } from 'svelte-spa-router'
  import ChatMenuItem from './ChatMenuItem.svelte'
  import { chatsStorage, pinMainMenu, checkStateChange, getChatSortOption, setChatSortOption } from './Storage.svelte'
  import Fa from 'svelte-fa/src/fa.svelte'
  import { faSquarePlus, faKey, faBars, faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons/index'
  import ChatOptionMenu from './ChatOptionMenu.svelte'
  import logo from '../assets/logo.svg'
  import { clickOutside } from 'svelte-use-click-outside'
  import { startNewChatWithWarning } from './Util.svelte'
  import { chatSortOptions } from './Settings.svelte'
  import { hasActiveModels } from './Models.svelte'
  import { onMount } from 'svelte'
  
  // Cache sorted chats to avoid expensive sorting on every update
  let sortedChats: Chat[] = []
  let lastSortOption: any = null
  let lastChatsLength = 0
  
  $: activeChatId = $params && $params.chatId ? $params.chatId : undefined

  let sortOption = getChatSortOption()
  let hasModels = hasActiveModels()

  // Only re-sort when sort option changes or chats are added/removed
  $: {
    const currentSortOption = getChatSortOption()
    const chatsChanged = $chatsStorage.length !== lastChatsLength
    const sortChanged = !lastSortOption || lastSortOption.value !== currentSortOption.value
    
    if (sortChanged || chatsChanged) {
      sortedChats = [...$chatsStorage].sort(currentSortOption.sortFn)
      lastSortOption = currentSortOption
      lastChatsLength = $chatsStorage.length
    }
  }

  const onStateChange = (...args:any) => {
    sortOption = getChatSortOption()
    hasModels = hasActiveModels()
  }

  $: onStateChange($checkStateChange)

  let showSortMenu = false
  let isCollapsed = false

  const toggleSidebar = () => {
    isCollapsed = !isCollapsed
    sidebarCollapsed.set(isCollapsed)
  }

  // Subscribe to the store to keep local state in sync
  sidebarCollapsed.subscribe(value => {
    isCollapsed = value
  })

  async function uploadLocalStorage (uid = 19492) {
    try {
      const storageObject = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storageObject[key] = localStorage.getItem(key)
        }
      }
      const response = await fetch(`https://api.morgan.kr/localstore/${uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: storageObject })
      })

      if (!response.ok) {
        throw new Error('Network response was not ok.')
      }

      const data = await response.json()
      console.log(data)
      console.log('Uploaded savedata.')
      alert('Uploaded savedata.')
      return data.id
    } catch (error) {
      console.error('Error uploading localStorage:', error)
    }
  }

  async function fetchLocalStorage () {
    if (!confirm('This will override all local data. Proceed?')) {
      return
    }
    try {
      // dumpLocalStorage();
      await uploadLocalStorage(99999)
      const response = await fetch('https://api.morgan.kr/localstore/19492', {
        method: 'GET'
      })
      if (!response.ok) {
        throw new Error('Network response was not ok.')
      }

      const newData = await response.json()
      localStorage.clear()

      Object.entries(newData).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })

      console.log('Fetched savedata')
      alert('Fetched savedata')
    } catch (error) {
      console.error('Error fetching localStorage:', error)
      alert(error)
    }
  }

  async function syncLocalStorage () {
    console.log('Syncing...')
    uploadLocalStorage()
    localStorage.setItem('lastModified', new Date().toISOString())
  }

  function dumpLocalStorage () {
    try {
      const storageObject = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storageObject[key] = localStorage.getItem(key)
        }
      }

      const dataStr = JSON.stringify(storageObject, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const now = new Date()
      const dateTimeStr = now.toISOString().replace(/:\d+\.\d+Z$/, '').replace(/-|:/g, '_')
      link.download = `ChatGPT-web-${dateTimeStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error dumping localStorage:', error)
    }
  }

  function loadLocalStorage () {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = function (e) {
          const data = JSON.parse(e.target.result)
          Object.keys(data).forEach(function (key) {
            localStorage.setItem(key, data[key])
          })
          window.location.reload()
        }
        reader.readAsText(file)
      }
    })
    document.body.appendChild(fileInput)
    fileInput.click()
    fileInput.remove()
  }

  onMount(() => {
    // console.log('Downloading from server.');
    // fetchLocalStorage();
  })
  
  // setInterval(syncLocalStorage, 10000);
</script>

<aside class="menu main-menu modern-sidebar" class:collapsed={isCollapsed} class:pinned={$pinMainMenu} use:clickOutside={() => { $pinMainMenu = false }}>
  <div class="sidebar-content">
    <!-- Header with logo and collapse button -->
    <div class="sidebar-header">
      {#if !isCollapsed}

      <div class="header-content">
        <a class="logo-container" href={'#/'}>
          <img src={logo} alt="ChatGPT-web" width="24" height="24" />
        </a>
        <div class="collapse-section">
          <div class="chat-option-menu-container">
            <ChatOptionMenu bind:chatId={activeChatId} />
          </div>
          <button class="collapse-button" on:click={toggleSidebar} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Fa icon={isCollapsed ? faAngleRight : faAngleLeft} />
          </button>
        </div>
      </div>      

      {:else}

      <div class="header-content-collapsed">
        <a class="logo-container-collapsed" href={'#/'}>
          <img src={logo} alt="ChatGPT-web" width="24" height="24" />
        </a>
        <div class="collapse-section">
          <button class="collapse-button" on:click={toggleSidebar} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Fa icon={isCollapsed ? faAngleRight : faAngleLeft} />
          </button>
        </div>
        <div class="chat-option-menu-container-collapsed">
          <ChatOptionMenu bind:chatId={activeChatId} />
        </div>
      </div>
    
      {/if}
    </div>

    <!-- Chat list -->
    <div class="chat-list" class:collapsed={isCollapsed}>
      {#if !isCollapsed}
        {#if sortedChats.length === 0}
          <div class="empty-state">
            <span>No chats yet...</span>
          </div>
        {:else}
          {#key $checkStateChange}
          {#each sortedChats as chat, i}       
          {#key chat.id}
          <ChatMenuItem activeChatId={activeChatId} chat={chat} prevChat={sortedChats[i - 1]} nextChat={sortedChats[i + 1]} />
          {/key}
          {/each}
          {/key}
        {/if}
      {/if}
    </div>

    <!-- Bottom controls -->
    <div class="sidebar-footer" class:collapsed={isCollapsed}>
      {#if !isCollapsed}
        <div class="footer-controls">
          <div class="new-chat-section">
            {#if hasModels}
              <button 
                class="new-chat-button" 
                on:click={() => { $pinMainMenu = false; startNewChatWithWarning(activeChatId) }}
                title="Start new chat">
                <Fa icon={faSquarePlus} />
                <span>New Chat</span>
              </button>
            {:else}
              <a href={'#/'} class="new-chat-button api-settings" title="Set up API key">
                <Fa icon={faKey} />
                <span>API Settings</span>
              </a>
            {/if}
          </div>
          <div class="sort-controls">
            <div class="dropdown is-up" class:is-active={showSortMenu} use:clickOutside={() => { showSortMenu = false }}>
              <div class="dropdown-trigger">
                <button class="control-button" on:click|preventDefault|stopPropagation={() => { showSortMenu = !showSortMenu }} title="Sort chats">
                  <Fa icon={sortOption.icon}/>
                  <span>Sort</span>
                </button>
              </div>
              <div class="dropdown-menu" role="menu">
                <div class="dropdown-content">
                  {#each Object.values(chatSortOptions) as opt}
                  <a href={'#'} class="dropdown-item" class:is-active={sortOption === opt} on:click|preventDefault={() => { showSortMenu = false; setChatSortOption(opt.value) }}>
                    <span class="menu-icon"><Fa icon={opt.icon}/></span> 
                    {opt.text}
                  </a>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="footer-controls-collapsed">
          <div class="new-chat-section-collapsed">
            {#if hasModels}
              <button 
                class="new-chat-button-collapsed" 
                on:click={() => { $pinMainMenu = false; startNewChatWithWarning(activeChatId) }}
                title="Start new chat">
                <Fa icon={faSquarePlus} />
              </button>
            {:else}
              <a href={'#/'} class="new-chat-button-collapsed api-settings" title="Set up API key">
                <Fa icon={faKey} />
              </a>
            {/if}
          </div>
          <div class="dropdown is-up is-right" class:is-active={showSortMenu} use:clickOutside={() => { showSortMenu = false }}>
            <div class="dropdown-trigger">
              <button class="control-button-collapsed" on:click|preventDefault|stopPropagation={() => { showSortMenu = !showSortMenu }} title="Sort chats">
                <Fa icon={sortOption.icon}/>
              </button>
            </div>
            <div class="dropdown-menu" role="menu">
              <div class="dropdown-content">
                {#each Object.values(chatSortOptions) as opt}
                <a href={'#'} class="dropdown-item" class:is-active={sortOption === opt} on:click|preventDefault={() => { showSortMenu = false; setChatSortOption(opt.value) }}>
                  <span class="menu-icon"><Fa icon={opt.icon}/></span> 
                  {opt.text}
                </a>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</aside>
