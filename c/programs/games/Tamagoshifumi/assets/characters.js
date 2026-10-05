export default {
  shoto: {
    name: "Shoto",
    stage: "dojo",
    infos: {
      age: "25",
      job: "Unemployed",
      country: "Japan",
      blood: "A+",
      hobby: "Mahjong",
    },
    hp: 10,
    moves: {
      super: {
        damage: 5,
        type: "attack",
        inputs: "QCF_ROCK",
      },
      attack: { damage: 2 },
      block: { damage: 1 },
      grab: { damage: 1 },
    },
  },

  kent: {
    name: "Kent",
    stage: "road",
    infos: {
      age: "25",
      job: "Crypto-trader",
      country: "USA",
      blood: "O-",
      hobby: "Sport Cars",
    },
    hp: 10,
    moves: {
      super: {
        damage: 5,
        type: "block",
        inputs: "DP_PAPER",
      },
      attack: { damage: 1 },
      block: { damage: 2 },
      grab: { damage: 1 },
    },
  },

  tyfenn: {
    name: "Tyfenn",
    stage: "bzh",
    infos: {
      age: "20",
      job: "Crepiere",
      country: "BZH",
      blood: "B+",
      hobby: "Karaoke",
    },
    hp: 9,
    moves: {
      super: {
        damage: 6,
        type: "attack",
        inputs: "HCF_ROCK",
      },
      attack: { damage: 3 },
      block: { damage: 1 },
      grab: { damage: 1 },
    },
  },

  eva: {
    name: "Eva",
    stage: "city",
    infos: {
      age: "30",
      job: "Cop",
      country: "Germany",
      blood: "O-",
      hobby: "Fitness",
    },
    hp: 9,
    moves: {
      super: {
        damage: 5,
        type: "grab",
        inputs: "360_SCISSORS",
      },
      attack: { damage: 1 },
      block: { damage: 1 },
      grab: { damage: 4 },
    },
  },

  /*  */

  utf8: {
    name: "UTF-8",
    stage: "factory",
    infos: {
      age: "1",
      job: "Apocalyptic robot",
      country: "Near future",
      blood: "Pu",
      hobby: "Go game",
    },
    hp: 12,
    moves: {
      super: {
        damage: 5,
        type: "attack",
        inputs: "360_ROCK",
      },
      attack: { damage: 2 },
      block: { damage: 1 },
      grab: { damage: 1 },
    },
  },

  queen: {
    name: "Queen",
    stage: "spaceship",
    infos: {
      age: "300",
      job: "Reproductive",
      country: "Zeta Reticuli",
      blood: "Acid",
      hobby: "Raw Meat",
    },
    hp: 10,
    moves: {
      super: {
        damage: 3,
        heal: 3,
        type: "grab",
        inputs: "360_SCISSORS",
      },
      attack: { damage: 2 },
      block: { damage: 1 },
      grab: { damage: 2 },
    },
  },

  marco: {
    name: "Marco",
    stage: "parking",
    infos: {
      age: "40",
      job: "Pizzaiolo",
      country: "Italy",
      blood: "AB+",
      hobby: "Cosplay",
    },
    hp: 8,
    moves: {
      super: {
        damage: 0,
        heal: 8,
        type: "block",
        inputs: "QCF_PAPER",
      },
      attack: { damage: 1 },
      block: { damage: 2 },
      grab: { damage: 1 },
    },
  },

  kuno: {
    name: "Kuno",
    stage: "china",
    infos: {
      age: "?",
      job: "Ninja",
      country: "?",
      blood: "O+",
      hobby: "?",
    },
    hp: 11,
    moves: {
      super: {
        damage: 4,
        type: "block",
        inputs: "DP_PAPER",
      },
      attack: { damage: 2 },
      block: { damage: 2 },
      grab: { damage: 2 },
    },
  },
};
