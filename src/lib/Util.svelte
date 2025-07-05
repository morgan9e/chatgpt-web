<script  context="module" lang="ts">
  import { compare } from 'stacking-order'
  import { openModal } from 'svelte-modals'
  import PromptNotice from './PromptNotice.svelte'
  import { addChat, getChat } from './Storage.svelte'
  import { replace } from 'svelte-spa-router'
  // import PromptConfirm from './PromptConfirm.svelte'
  import type { ChatSettings } from './Types.svelte'
  
  // Generate a short UUID (8 characters) for chat IDs using hex format (0-9a-f)
  export const generateShortId = (): string => {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
  
  // Cache for auto-size elements to avoid expensive DOM queries
  let cachedAutoSizeElements: HTMLTextAreaElement[] = []
  let lastElementCount = 0

  export const sizeTextElements = (force?: boolean) => {
    // Only re-query if force is true or element count changed
    const currentElements = document.querySelectorAll('textarea.auto-size')
    if (force || currentElements.length !== lastElementCount) {
      cachedAutoSizeElements = Array.from(currentElements) as HTMLTextAreaElement[]
      lastElementCount = currentElements.length
    }
    
    // Use cached elements for better performance
    for (let i = 0, l = cachedAutoSizeElements.length; i < l; i++) {
      const el = cachedAutoSizeElements[i]
      // Check if element is still in DOM
      if (document.contains(el)) {
        autoGrowInput(el, force)
      }
    }
  }

  export const autoGrowInputOnEvent = (event: Event) => {
    // Resize the textarea to fit the content - auto is important to reset the height after deleting content
    if (event.target === null) return
    (event.target as any).__didAutoGrow = false
    autoGrowInput(event.target as HTMLTextAreaElement)
  }

  export const autoGrowInput = (el: HTMLTextAreaElement, force?: boolean) => {
    const anyEl = el as any // Oh how I hate typescript.  All the markup of Java with no real payoff..
    if (force || !anyEl.__didAutoGrow) el.style.height = '38px' // don't use "auto" here.  Firefox will over-size.
    el.style.height = el.scrollHeight + 'px'
    setTimeout(() => {
      if (el.scrollHeight > el.getBoundingClientRect().height + 5) {
        el.style.overflowY = 'auto'
      } else {
        el.style.overflowY = ''
      }
    }, 0)
    anyEl.__didAutoGrow = true // don't resize this one again unless it's via an event
  }

  export const scrollIntoViewWithOffset = (element:HTMLElement, offset:number, instant:boolean = false, bottom:boolean = false) => {
    const behavior = instant ? 'instant' : 'smooth'
    if (bottom) {
      window.scrollTo({
        behavior: behavior as any,
        top:
        (element.getBoundingClientRect().bottom) -
        document.body.getBoundingClientRect().top - (window.innerHeight - offset)
      })
    } else {
      window.scrollTo({
        behavior: behavior as any,
        top:
        element.getBoundingClientRect().top -
        document.body.getBoundingClientRect().top -
        offset
      })
    }
  }

  export const scrollToMessage = (uuid:string | string[] | undefined, offset:number = 60, instant:boolean = false, bottom:boolean = false) => {
    if (Array.isArray(uuid)) {
      uuid = uuid[0]
    }
    if (!uuid) {
      console.error('Not a valid uuid', uuid)
      return
    }
    const el = document.getElementById('message-' + uuid)
    if (el) {
      scrollIntoViewWithOffset(el, offset, instant, bottom)
    } else {
      console.error("Can't find element with message ID", uuid)
    }
  }

  export const scrollToBottom = (instant:boolean = false) => {
    setTimeout(() => document.querySelector('body')?.scrollIntoView({ behavior: (instant ? 'instant' : 'smooth') as any, block: 'end' }), 0)
  }


  export const checkModalEsc = (event:KeyboardEvent|undefined):boolean|void => {
    if (!event || event.key !== 'Escape') return
    dispatchModalEsc()
  }

  export const dispatchModalEsc = ():boolean|void => {
    const stack = Array.from(document.querySelectorAll('.modal, .has-esc')).filter(s =>
      window.getComputedStyle(s).getPropertyValue('display') !== 'none'
    )
    const top:HTMLElement = stack.length === 1
      ? stack[0]
      : stack.find(m1 => {
        return stack.find(m2 => {
          return m1 !== m2 && compare(m1, m2) > 0 && m1
        })
      }) as any
    if (top) {
      // trigger modal-esc event on topmost modal when esc key is pressed
      const e = new CustomEvent('modal-esc', { detail: top })
      top.dispatchEvent(e)
    }
  }

  export const encodeHTMLEntities = (rawStr:string) => {
    return rawStr.replace(/[\u00A0-\u9999<>&]/g, (i) => `&#${i.charCodeAt(0)};`)
  }

  export const errorNotice = (message:string, error:Error|undefined = undefined):any => {
    openModal(PromptNotice, {
      title: 'Error',
      class: 'is-danger',
      message: message + (error ? '<br>' + error.message : ''),
      asHtml: true,
      onConfirm: () => {}
    })
  }
  
  export const warningNotice = (message:string, error:Error|undefined = undefined):any => {
    openModal(PromptNotice, {
      title: 'Warning',
      class: 'is-warning',
      message: message + (error ? '<br>' + error.message : ''),
      asHtml: true,
      onConfirm: () => {}
    })
  }

  export const startNewChatFromChatId = (chatId: string) => {
    const newChatId = addChat(getChat(chatId).settings)
    // go to new chat
    replace(`/chat/${newChatId}`)
  }

  export const startNewChatWithWarning = (activeChatId: string|undefined, profile?: ChatSettings|undefined) => {
    const newChat = () => {
      const chatId = addChat(profile)
      replace(`/chat/${chatId}`)
    }
    // if (activeChatId && getChat(activeChatId).settings.isDirty) {
    //   openModal(PromptConfirm, {
    //     title: 'Unsaved Profile',
    //     message: '<p>There are unsaved changes to your current profile that will be lost.</p><p>Discard these changes and continue with new chat?</p>',
    //     asHtml: true,
    //     class: 'is-warning',
    //     onConfirm: () => {
    //       newChat()
    //     }
    //   })
    // } else {
    //   newChat()
    // }
    newChat()
  }

  export const valueOf = (chatId: string, value: any) => {
    if (typeof value === 'function') return value(chatId)
    return value
  }

  // Migration function to convert old numeric chat IDs to hex UUIDs
  export const migrateChatData = () => {
    try {
      const chatsDataString = localStorage.getItem('chats')
      if (!chatsDataString) {
        console.log('No chat data found to migrate')
        return false
      }

      const chatsData = JSON.parse(chatsDataString)
      if (!Array.isArray(chatsData) || chatsData.length === 0) {
        console.log('No chats to migrate')
        return false
      }

      let migratedCount = 0
      const migrationMap = new Map() // old ID -> new ID mapping

      // First pass: identify chats with numeric IDs and create new UUIDs
      chatsData.forEach(chat => {
        if (typeof chat.id === 'number') {
          const newId = generateShortId()
          migrationMap.set(chat.id, newId)
          chat.id = newId
          migratedCount++
        }
      })

      if (migratedCount === 0) {
        console.log('No numeric chat IDs found to migrate')
        return false
      }

      // Update lastChatId if it was numeric
      const lastChatIdString = localStorage.getItem('lastChatId')
      if (lastChatIdString) {
        const lastChatId = JSON.parse(lastChatIdString)
        if (typeof lastChatId === 'number' && migrationMap.has(lastChatId)) {
          localStorage.setItem('lastChatId', JSON.stringify(migrationMap.get(lastChatId)))
        }
      }

      // Save migrated data back to localStorage
      localStorage.setItem('chats', JSON.stringify(chatsData))
      
      console.log(`Successfully migrated ${migratedCount} chats from numeric IDs to hex UUIDs`)
      return true
    } catch (error) {
      console.error('Error during chat data migration:', error)
      return false
    }
  }

  export const escapeRegex = (string: string): string => {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
  }

</script> 