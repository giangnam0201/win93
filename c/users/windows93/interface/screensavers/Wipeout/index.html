<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wipeout</title>

<style>
  body {
    margin: 0px;
    overflow: hidden;
  }
</style>

<div id="container"></div>

<script src="three.js"></script>
<script src="orbit-controls.js"></script>
<script src="js-struct.js"></script>
<script src="HermiteCurve3.js"></script>
<script src="wipeout.js"></script>

<script type="module">
  const viewer = new Wipeout("container", window.innerWidth, window.innerHeight)

  let timerId

  function loadTrack() {
    clearTimeout(timerId)
    const tracks =
      Wipeout.Tracks[Math.random() > 0.5 ? "Wipeout" : "Wipeout2097"]
    const track = tracks[Math.floor(Math.random() * tracks.length)]
    viewer.clear()
    viewer.loadTrack(track.path, track.hasTEXFile)
    cancelAnimationFrame(viewer.rafId)
    viewer.animate()

    // const loopTime = viewer.cameraSpline.points.length * 100
    // console.log(loopTime)

    timerId = setTimeout(loadTrack, Math.random() * 6e4 + 4e4)
  }

  loadTrack()

  document.body.addEventListener("click", () => loadTrack())
  addEventListener(
    "wheel",
    (e) => {
      // const time = Date.now()

      // const elapsedTime = time - viewer.startTime
      // const elapsedTicks = (elapsedTime / 1000) * 60

      cancelAnimationFrame(viewer.rafId)
      viewer.updateSplineCamera()
      viewer.ticks += e.deltaY > 0 ? -1 : 1
      if (viewer.ticks < 0) viewer.ticks = 0
      viewer.updateSplineCamera()
      // viewer.updateSplineCamera()

      // while (viewer.ticks < elapsedTicks) {
      //   viewer.ticks++
      // }

      viewer.rotateSpritesToCamera(viewer.splineCamera)
      viewer.renderer.render(viewer.scene, viewer.splineCamera)

      // const elapsedTime = time - this.startTime
      // var elapsedTicks = elapsedTime / 1000 * 60;
      // console.log(elapsedTicks)
      // this.startTime -= elapsedTime

      viewer.animate()
    },
    { passive: false, capture: true },
  )
</script>
