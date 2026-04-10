/**
 * Passed to Playwright page.evaluate — keep as plain .mjs so tsx does not inject
 * helpers into the serialized function.
 */
export default async function compareInBrowser(input) {
  const [a, b] = input
  const W = 512
  const H = 512
  const thr = 14
  return new Promise((resolve, reject) => {
    const imgA = new Image()
    const imgB = new Image()
    let n = 0
    const tryDone = () => {
      if (++n < 2) return
      try {
        const cA = document.createElement('canvas')
        cA.width = W
        cA.height = H
        const cB = document.createElement('canvas')
        cB.width = W
        cB.height = H
        const ctxA = cA.getContext('2d')
        const ctxB = cB.getContext('2d')
        if (!ctxA || !ctxB) {
          reject(new Error('2d context'))
          return
        }
        ctxA.drawImage(imgA, 0, 0, W, H)
        ctxB.drawImage(imgB, 0, 0, W, H)
        const dA = ctxA.getImageData(0, 0, W, H)
        const dB = ctxB.getImageData(0, 0, W, H)
        let differingPixels = 0
        const diffCanvas = document.createElement('canvas')
        diffCanvas.width = W
        diffCanvas.height = H
        const dCtx = diffCanvas.getContext('2d')
        if (!dCtx) {
          reject(new Error('diff 2d context'))
          return
        }
        const out = dCtx.createImageData(W, H)
        const total = W * H
        for (let i = 0; i < dA.data.length; i += 4) {
          let isDiff = false
          for (let c = 0; c < 4; c++) {
            if (Math.abs(dA.data[i + c] - dB.data[i + c]) > thr) {
              isDiff = true
              break
            }
          }
          if (isDiff) {
            differingPixels++
            out.data[i] = 255
            out.data[i + 1] = 0
            out.data[i + 2] = 220
            out.data[i + 3] = 255
          } else {
            out.data[i] = 0
            out.data[i + 1] = 0
            out.data[i + 2] = 0
            out.data[i + 3] = 0
          }
        }
        dCtx.putImageData(out, 0, 0)
        const mismatchPercent = (differingPixels / total) * 100
        const diffPngBase64 = diffCanvas.toDataURL('image/png').split(',')[1] ?? ''
        resolve({
          mismatchPercent,
          compareWidth: W,
          compareHeight: H,
          totalPixelsCompared: total,
          differingPixels,
          diffPngBase64,
        })
      } catch (e) {
        reject(e)
      }
    }
    imgA.onerror = () => reject(new Error('failed to decode --render image'))
    imgB.onerror = () => reject(new Error('failed to decode --wiki image'))
    imgA.onload = tryDone
    imgB.onload = tryDone
    imgA.src = 'data:image/png;base64,' + a
    imgB.src = 'data:image/png;base64,' + b
  })
}
