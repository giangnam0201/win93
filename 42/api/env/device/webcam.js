export const webcam = {
  async check() {
    // TODO: check on mobile and on unsecure http
    const md = navigator.mediaDevices
    if (!md || !md.enumerateDevices) return false
    const devices = await md.enumerateDevices()
    return devices.some((device) => device.kind === "videoinput")
  },

  async request() {
    return navigator.mediaDevices.getUserMedia({ video: true })
  },
}
