const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 500,
    backgroundColor: "#87CEEB",
    physics: {
        default: "matter",
        matter: {
            gravity: { y: 1 },
            debug: false
        }
    },
    scene: [GameScene]
};

new Phaser.Game(config);