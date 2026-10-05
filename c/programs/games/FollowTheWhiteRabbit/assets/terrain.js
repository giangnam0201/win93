/* eslint-disable camelcase */
// prettier-ignore
export default {
  terrains: {
    grass: {
      ground: true,
      solid: { x: 96, y: 96, w: 32, h: 32 },
      variations: [
        { x: 64, y: 96, w: 32, h: 32, rarity: 40 },
        { x: 32, y: 96, w: 32, h: 32, rarity: 95 },
        { x: 0,  y: 96, w: 32, h: 32, rarity: 98 }
      ]
    },
    dirt: {
      solid: { x: 160, y: 96, w: 32, h: 32 },
      outer_corner: {
        topleft:     { x: 0,  y: 0,  w: 16, h: 16 },
        topright:    { x: 16, y: 0,  w: 16, h: 16 },
        bottomleft:  { x: 0,  y: 16, w: 16, h: 16 },
        bottomright: { x: 16, y: 16, w: 16, h: 16 }
      },
      inner_corner: {
        topleft:     { x: 32, y: 0,  w: 16, h: 16 },
        topright:    { x: 48, y: 0,  w: 16, h: 16 },
        bottomleft:  { x: 32, y: 16, w: 16, h: 16 },
        bottomright: { x: 48, y: 16, w: 16, h: 16 }
      },
      edge: {
        top_left:     { x: 16, y: 32, w: 16, h: 16 },
        top_right:    { x: 32, y: 32, w: 16, h: 16 },
        bottom_left:  { x: 16, y: 80, w: 16, h: 16 },
        bottom_right: { x: 32, y: 80, w: 16, h: 16 },
        left_top:     { x: 0,  y: 48, w: 16, h: 16 },
        left_bottom:  { x: 0,  y: 64, w: 16, h: 16 },
        right_top:    { x: 48, y: 48, w: 16, h: 16 },
        right_bottom: { x: 48, y: 64, w: 16, h: 16 }
      },
    },
    water: {
      solid: { x: 128, y: 96, w: 32, h: 32, block: true },
      frames: [
        {
          duration: 100,
          outer_corner: {
            topleft:     { x: 64, y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 80, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 64, y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 80, y: 16, w: 16, h: 16, block: true }
          },
          inner_corner: {
            topleft:     { x: 96,  y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 112, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 96,  y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 112, y: 16, w: 16, h: 16, block: true }
          },
          edge: {
            top_left:     { x: 64 + 16, y: 32, w: 16, h: 16, block: true },
            top_right:    { x: 64 + 32, y: 32, w: 16, h: 16, block: true },
            bottom_left:  { x: 64 + 16, y: 80, w: 16, h: 16, block: true },
            bottom_right: { x: 64 + 32, y: 80, w: 16, h: 16, block: true },
            left_top:     { x: 64 + 0,  y: 48, w: 16, h: 16, block: true },
            left_bottom:  { x: 64 + 0,  y: 64, w: 16, h: 16, block: true },
            right_top:    { x: 64 + 48, y: 48, w: 16, h: 16, block: true },
            right_bottom: { x: 64 + 48, y: 64, w: 16, h: 16, block: true }
          }
        },
        {
          duration: 100,
          outer_corner: {
            topleft:     { x: 64 + 64, y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 64 + 80, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 64 + 64, y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 64 + 80, y: 16, w: 16, h: 16, block: true }
          },
          inner_corner: {
            topleft:     { x: 64 + 96,  y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 64 + 112, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 64 + 96,  y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 64 + 112, y: 16, w: 16, h: 16, block: true }
          },
          edge: {
            top_left:     { x: 64 + 64 + 16, y: 32, w: 16, h: 16, block: true },
            top_right:    { x: 64 + 64 + 32, y: 32, w: 16, h: 16, block: true },
            bottom_left:  { x: 64 + 64 + 16, y: 80, w: 16, h: 16, block: true },
            bottom_right: { x: 64 + 64 + 32, y: 80, w: 16, h: 16, block: true },
            left_top:     { x: 64 + 64 + 0,  y: 48, w: 16, h: 16, block: true },
            left_bottom:  { x: 64 + 64 + 0,  y: 64, w: 16, h: 16, block: true },
            right_top:    { x: 64 + 64 + 48, y: 48, w: 16, h: 16, block: true },
            right_bottom: { x: 64 + 64 + 48, y: 64, w: 16, h: 16, block: true }
          }
        },
        {
          duration: 100,
          outer_corner: {
            topleft:     { x: 128 + 64, y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 128 + 80, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 128 + 64, y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 128 + 80, y: 16, w: 16, h: 16, block: true }
          },
          inner_corner: {
            topleft:     { x: 128 + 96,  y: 0,  w: 16, h: 16, block: true },
            topright:    { x: 128 + 112, y: 0,  w: 16, h: 16, block: true },
            bottomleft:  { x: 128 + 96,  y: 16, w: 16, h: 16, block: true },
            bottomright: { x: 128 + 112, y: 16, w: 16, h: 16, block: true }
          },
          edge: {
            top_left:     { x: 128 + 64 + 16, y: 32, w: 16, h: 16, block: true },
            top_right:    { x: 128 + 64 + 32, y: 32, w: 16, h: 16, block: true },
            bottom_left:  { x: 128 + 64 + 16, y: 80, w: 16, h: 16, block: true },
            bottom_right: { x: 128 + 64 + 32, y: 80, w: 16, h: 16, block: true },
            left_top:     { x: 128 + 64 + 0,  y: 48, w: 16, h: 16, block: true },
            left_bottom:  { x: 128 + 64 + 0,  y: 64, w: 16, h: 16, block: true },
            right_top:    { x: 128 + 64 + 48, y: 48, w: 16, h: 16, block: true },
            right_bottom: { x: 128 + 64 + 48, y: 64, w: 16, h: 16, block: true }
          }
        },
      ]
    }
  },
  assets: {
    broadleaf_large:     { x: 0,   y: 128, w: 96,  h: 144, rarity: 90,
                  block: { x: 32, y: 128 + 144 - 32, w: 32, h: 32 } },
    broadleaf_medium:    { x: 96,  y: 144, w: 96,  h: 128, rarity: 80,
                  block: { x: 96 + 32, y: 128 + 144 - 32, w: 32, h: 32 } },
    pine_large:          { x: 0,   y: 272, w: 96,  h: 160, rarity: 90,
                  block: { x: 32,  y: 272 + 160 - 32, w: 32, h: 32 } },
    pine_medium:         { x: 96,  y: 288, w: 96,  h: 144, rarity: 80,
                  block: { x: 96 + 32,  y: 272 + 160 - 32, w: 32, h: 32 } },
    white_mushrooms_01:  { x: 192, y: 96,  w: 32,  h: 32,  rarity: 40 },
    white_mushrooms_02:  { x: 192, y: 128, w: 32,  h: 32,  rarity: 90 },
    red_mushrooms_01:    { x: 192, y: 160, w: 32,  h: 32,  rarity: 80 },
    red_mushrooms_02:    { x: 192, y: 192, w: 32,  h: 32,  rarity: 92 },
    red_mushrooms_03:    { x: 192, y: 224, w: 32,  h: 32,  rarity: 95 },
    red_mushrooms_04:    { x: 192, y: 256, w: 32,  h: 32,  rarity: 98, block: true },
    rock_01:             { x: 224, y: 96,  w: 32,  h: 32,  rarity: 80, block: true, biome: ['grass', ['dirt', 80]] },
    rock_02:             { x: 224, y: 128, w: 32,  h: 32,  rarity: 90, block: true, biome: ['grass', ['dirt', 95]] },
    rock_03:             { x: 224, y: 160, w: 32,  h: 32,  rarity: 95, block: true, biome: ['grass'] },
    rock_04:             { x: 224, y: 192, w: 32,  h: 32,  rarity: 98, block: true, biome: ['grass'] },
    daisy_flower_01:     { x: 224, y: 224, w: 32,  h: 32,  rarity: 60 },
    daisy_flower_02:     { x: 224, y: 256, w: 32,  h: 32,  rarity: 90 }
  }
}
