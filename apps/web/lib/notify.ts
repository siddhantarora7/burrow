/**
 * A system notification, if the browser allows one. Never throws: Android Chrome refuses the
 * constructor outside a service worker, and an alert must not take the garden down with it.
 */
export function notify(title: string, body: string): boolean {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
    const n = new Notification(title, { body, tag: 'burrow' })
    n.onclick = () => {
      focus()
      n.close()
    }
    return true
  } catch {
    return false
  }
}
