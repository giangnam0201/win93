export class Sprite {
  constructor(game, image, spriteData) {
    this.game = game
    this.image = image
    this.spriteData = spriteData
    this.width = spriteData.spriteWidth
    this.height = spriteData.spriteHeight

    this.currentAnimation = null
    this.currentFrameIndex = 0
    this.frameTimer = 0
    this.frameDuration = 100

    this.isMirrored = false
  }

  play(animationName, isMirrored = false) {
    if (
      this.currentAnimation !== animationName ||
      this.isMirrored !== isMirrored
    ) {
      this.currentAnimation = animationName
      this.isMirrored = isMirrored
      this.currentFrameIndex = 0
      this.frameTimer = 0
    }
  }

  update(deltaTime) {
    if (!this.currentAnimation) return

    const animData = this.spriteData.animations[this.currentAnimation]
    if (!animData) return

    this.frameTimer += deltaTime

    if (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration
      this.currentFrameIndex++

      // Stop at the last frame, don't loop indefinitely unless we want it to.
      // For jumping, we just play through and freeze on the last frame until state changes.
      if (this.currentFrameIndex >= animData.frames.length) {
        this.currentFrameIndex = animData.frames.length - 1
      }
    }
  }

  draw(ctx, renderX, renderY, scale, logicalTileSize) {
    if (!this.currentAnimation) return

    const animData = this.spriteData.animations[this.currentAnimation]
    if (!animData) return

    const frame = animData.frames[this.currentFrameIndex]

    // The sprite is 64x64, but logically occupies 32x32.
    // So we offset drawing by half the size difference to center the 64x64 sprite over the 32x32 block.
    const sizeDiffX = (this.width - logicalTileSize) / 2
    const sizeDiffY = (this.height - logicalTileSize) / 2

    const drawX = renderX - sizeDiffX * scale
    const drawY = renderY - sizeDiffY * scale

    ctx.save()

    if (this.isMirrored) {
      // Move to center of drawing area, flip scale, move back
      ctx.translate(
        drawX + (this.width * scale) / 2,
        drawY + (this.height * scale) / 2,
      )
      ctx.scale(-1, 1)
      ctx.translate(
        -(drawX + (this.width * scale) / 2),
        -(drawY + (this.height * scale) / 2),
      )
    }

    ctx.drawImage(
      this.image,
      frame.x,
      frame.y,
      this.width,
      this.height,
      drawX,
      drawY,
      this.width * scale,
      this.height * scale,
    )

    ctx.restore()

    // // DEBUG bounds (logical 32x32)
    // ctx.strokeStyle = "red"
    // ctx.strokeRect(
    //   renderX,
    //   renderY,
    //   logicalTileSize * scale,
    //   logicalTileSize * scale,
    // )
  }
}
