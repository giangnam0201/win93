export default {
  spriteWidth: 64,
  spriteHeight: 64,
  animations: {
    prepare_up: {
      frames: [
        { x: 0, y: 0 },
        { x: 64, y: 0 },
        { x: 128, y: 0 },
        { x: 192, y: 0 },
      ],
    },
    jump_up: {
      frames: [
        { x: 0, y: 64 },
        { x: 64, y: 64 },
        { x: 128, y: 64 },
        { x: 192, y: 64 },
      ],
    },
    prepare_down: {
      frames: [
        { x: 0, y: 128 },
        { x: 64, y: 128 },
        { x: 128, y: 128 },
        { x: 192, y: 128 },
      ],
    },
    jump_down: {
      frames: [
        { x: 0, y: 192 },
        { x: 64, y: 192 },
        { x: 128, y: 192 },
        { x: 192, y: 192 },
      ],
    },
    prepare_right: {
      frames: [
        { x: 0, y: 256 },
        { x: 64, y: 256 },
        { x: 128, y: 256 },
        { x: 192, y: 256 },
      ],
    },
    jump_right: {
      frames: [
        { x: 0, y: 320 },
        { x: 64, y: 320 },
        { x: 128, y: 320 },
        { x: 192, y: 320 },
      ],
    },
  },
}
