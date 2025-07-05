<script lang="ts">
  import { params } from 'svelte-spa-router'
  import ChatMenuItem from './ChatMenuItem.svelte'
  import { chatsStorage, pinMainMenu, checkStateChange, getChatSortOption, setChatSortOption } from './Storage.svelte'
  import Fa from 'svelte-fa/src/fa.svelte'
  import { faSquarePlus, faKey, faDownload, faRotate, faUpload } from '@fortawesome/free-solid-svg-icons/index'
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
  
  $: activeChatId = $params && $params.chatId ? parseInt($params.chatId) : undefined

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

<aside class="menu main-menu" class:pinned={$pinMainMenu} use:clickOutside={() => { $pinMainMenu = false }}>
  <div style="font-size:8px;position:fixed;top:1px;right:2px;">&&&BUILDVER&&&</div>
  <div class="menu-expanse">
      <div class="navbar-brand menu-nav-bar">
        <a class="navbar-item gpt-logo" href={'#/'}>
          <img src={logo} alt="ChatGPT-web" width="24" height="24" />
        </a>
        <div class="chat-option-menu navbar-item is-pulled-right">
          <ChatOptionMenu bind:chatId={activeChatId} />
        </div>
      </div>
    <ul class="menu-list menu-expansion-list">
      {#if sortedChats.length === 0}
        <li><a href={'#'} class="is-disabled">No chats yet...</a></li>
      {:else}
        {#key $checkStateChange}
        {#each sortedChats as chat, i}       
        {#key chat.id}
        <ChatMenuItem activeChatId={activeChatId} chat={chat} prevChat={sortedChats[i - 1]} nextChat={sortedChats[i + 1]} />
        {/key}
        {/each}
        {/key}
      {/if}
    </ul>
    <!-- <p class="menu-label">Actions</p> -->
    <div class="level is-mobile bottom-buttons p-1">
      <div class="level-left">
        <div class="dropdown is-left is-up" class:is-active={showSortMenu} use:clickOutside={() => { showSortMenu = false }}>
          <div class="dropdown-trigger">
            <button class="button" aria-haspopup="true" aria-controls="dropdown-menu3" on:click|preventDefault|stopPropagation={() => { showSortMenu = !showSortMenu }}>
              <span class="icon"><Fa icon={sortOption.icon}/></span>
            </button>
          </div>
          <div class="dropdown-menu" id="dropdown-menu3" role="menu">
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
        <div class="is-left is-up ml-2">
            <button class="button" aria-haspopup="true" on:click|preventDefault|stopPropagation={() => { loadLocalStorage() }}>
              <span class="icon"><Fa icon={faUpload}/></span>
            </button>
        </div>
        <div class="is-left is-up ml-2">
            <button class="button" aria-haspopup="true" on:click|preventDefault|stopPropagation={() => { dumpLocalStorage() }}>
              <span class="icon"><Fa icon={faDownload}/></span>
            </button>
        </div>
      </div>
      <div class="level-right">
        {#if !hasModels}
        <div class="level-item">
          <a href={'#/'} class="panel-block" class:is-disabled={!hasModels}
            ><span class="greyscale mr-1"><Fa icon={faKey} /></span> API Setting</a
          ></div>
        {:else}
        <div class="level-item">
          <button on:click={() => { $pinMainMenu = false; startNewChatWithWarning(activeChatId) }} class="panel-block button" title="Start new chat with default profile" class:is-disabled={!hasModels}
            ><span class="greyscale"><Fa icon={faSquarePlus} /></span></button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</aside>
