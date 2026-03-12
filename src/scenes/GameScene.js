class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");
    }

    create() {
        this.score        = 0;
        this.combos       = 0;
        this.combosNeeded = 3;
        this.balls        = [];
        this.wood         = [];   // { body, gfx, brd }
        this.isDragging   = false;
        this.currentBall  = null;
        this.toExplode    = [];
        this.deadIds      = new Set();

        const GY = 465;

        // ── SUELO ──
        this.matter.add.rectangle(400, 483, 800, 34, { isStatic: true, label: "ground" });
        this.add.rectangle(400, 483, 800, 34, 0x4a3728);

        // ── PAREDES ──
        this.matter.add.rectangle(-14, 250, 28, 500, { isStatic: true, label: "wall" });
        this.matter.add.rectangle(814, 250, 28, 500, { isStatic: true, label: "wall" });
        this.matter.add.rectangle(400, -14, 800, 28, { isStatic: true, label: "wall" });

        // ── LANZADOR ──
        this.slingshotX = 130;
        this.slingshotY = 370;
        this.add.rectangle(this.slingshotX - 10, this.slingshotY + 40, 8, 80, 0x6B3A1F);
        this.add.rectangle(this.slingshotX + 10, this.slingshotY + 40, 8, 80, 0x6B3A1F);
        this.add.rectangle(this.slingshotX,      this.slingshotY + 78, 30, 8, 0x6B3A1F);

        // ── ESTRUCTURA ──
        this.buildStructure(520, GY);

        // ── UI ──
        this.scoreText = this.add.text(20, 20, "Puntos: 0", {
            fontSize: "22px", fill: "#fff", fontStyle: "bold"
        }).setDepth(20);
        this.comboText = this.add.text(20, 50, "Combos: 0 / " + this.combosNeeded, {
            fontSize: "18px", fill: "#ffff00"
        }).setDepth(20);
        this.add.text(400, 14, "Arrastra la bola blanca para lanzar", {
            fontSize: "13px", fill: "#ffffffcc"
        }).setOrigin(0.5).setDepth(20);

        this.spawnProjectile();

        this.matter.world.on("collisionstart", this.onCollision, this);
        this.input.on("pointerdown", this.onDown, this);
        this.input.on("pointermove", this.onMove, this);
        this.input.on("pointerup",   this.onUp,   this);
    }

    buildStructure(cx, gy) {
        const T = 14;

        // PISO 1
        const h1 = 120, w1 = 140;
        this.plank(cx - w1/2, gy - h1/2,     T,    h1);
        this.plank(cx + w1/2, gy - h1/2,     T,    h1);
        this.plank(cx,        gy - h1 - T/2, w1+T, T);
        this.ball(cx, gy - 40, 0xff3333);

        // PISO 2
        const h2 = 90, w2 = 100;
        const b2 = gy - h1 - T;
        this.plank(cx - w2/2, b2 - h2/2,     T,    h2);
        this.plank(cx + w2/2, b2 - h2/2,     T,    h2);
        this.plank(cx,        b2 - h2 - T/2, w2+T, T);
        this.ball(cx, b2 - 35, 0x3399ff);

        // PISO 3
        const h3 = 60, w3 = 65;
        const b3 = b2 - h2 - T;
        this.plank(cx - w3/2, b3 - h3/2,     T,    h3);
        this.plank(cx + w3/2, b3 - h3/2,     T,    h3);
        this.plank(cx,        b3 - h3 - T/2, w3+T, T);
        this.ball(cx, b3 - 25, 0xff9900);
    }

    plank(x, y, w, h) {
        // Dinámica desde el inicio: alta densidad + alta fricción = estable
        // hasta que un proyectil con suficiente fuerza la mueva
        const body = this.matter.add.rectangle(x, y, w, h, {
            isStatic: false,
            label: "wood",
            density: 0.08,        // muy pesada
            friction: 1,          // mucha fricción con suelo y otras piezas
            frictionStatic: 1,    // fricción estática alta = no se mueve sola
            restitution: 0.05,
            frictionAir: 0.08
        });
        // Congelar rotación y posición horizontal para que no se caiga sola
        body.inertia = Infinity;
        body.inverseInertia = 0;

        const shade = Phaser.Math.Between(0, 18);
        const col = Phaser.Display.Color.GetColor(128 + shade, 80 + shade, 32 + shade);
        const gfx = this.add.rectangle(x, y, w, h, col).setDepth(2);
        const brd = this.add.rectangle(x, y, w, h).setDepth(3);
        brd.setStrokeStyle(2, 0x3d2000);
        brd.setFillStyle(0, 0);
        this.wood.push({ body, gfx, brd });
    }

    ball(x, y, color) {
        const body = this.matter.add.circle(x, y, 21, {
            label: "target",
            friction: 0.4,
            restitution: 0.4,
            density: 0.006,
            frictionAir: 0.01
        });
        const gfx   = this.add.circle(x, y, 21, color).setDepth(4);
        const shine = this.add.circle(x - 6, y - 6, 6, 0xffffff, 0.4).setDepth(5);
        this.balls.push({ body, gfx, shine });
    }

    spawnProjectile() {
        const body = this.matter.add.circle(
            this.slingshotX, this.slingshotY, 19,
            {
                label: "projectile",
                ignoreGravity: true,
                frictionAir: 1,
                friction: 0.3,
                restitution: 0.3,
                density: 0.05   // suficiente masa para mover la madera
            }
        );
        this.matter.body.setVelocity(body, { x: 0, y: 0 });
        const gfx   = this.add.circle(this.slingshotX, this.slingshotY, 19, 0xffffff).setDepth(6);
        const shine = this.add.circle(this.slingshotX - 5, this.slingshotY - 5, 6, 0xffffff, 0.7).setDepth(7);
        this.currentBall = { body, gfx, shine };
        this.balls.push(this.currentBall);
    }

    onDown() {
        if (this.currentBall) this.isDragging = true;
    }

    onMove(pointer) {
        if (!this.isDragging || !this.currentBall) return;
        const dx = Phaser.Math.Clamp(pointer.x - this.slingshotX, -100, 15);
        const dy = Phaser.Math.Clamp(pointer.y - this.slingshotY, -80, 80);
        const nx = this.slingshotX + dx;
        const ny = this.slingshotY + dy;
        this.matter.body.setPosition(this.currentBall.body, { x: nx, y: ny });
        this.currentBall.gfx.setPosition(nx, ny);
        this.currentBall.shine.setPosition(nx - 5, ny - 5);

        if (this.aimLine) this.aimLine.destroy();
        this.aimLine = this.add.graphics().setDepth(8);
        this.aimLine.lineStyle(2, 0xffffff, 0.5);
        this.aimLine.strokeLineShape(
            new Phaser.Geom.Line(this.slingshotX, this.slingshotY, nx, ny)
        );
    }

    onUp() {
        if (!this.isDragging || !this.currentBall) return;
        this.isDragging = false;
        if (this.aimLine) { this.aimLine.destroy(); this.aimLine = null; }

        const bx = this.currentBall.body.position.x;
        const by = this.currentBall.body.position.y;
        const vx = (this.slingshotX - bx) * 0.12;
        const vy = (this.slingshotY - by) * 0.12;

        this.currentBall.body.ignoreGravity = false;
        this.matter.body.set(this.currentBall.body, "frictionAir", 0.005);
        this.matter.body.setVelocity(this.currentBall.body, { x: vx, y: vy });

        const launchedId = this.currentBall.body.id;
        this.currentBall = null;

        this.time.delayedCall(1500, () => this.settleWood());
        this.time.delayedCall(3500, () => {
            this.killById(launchedId);
            this.spawnProjectile();
        });
    }

    settleWood() {
        for (const w of this.wood) {
            if (!w.body) continue;
            this.matter.body.setVelocity(w.body, {
                x: w.body.velocity.x * 0.05,
                y: w.body.velocity.y * 0.05
            });
            this.matter.body.setAngularVelocity(w.body, w.body.angularVelocity * 0.05);
            w.body.frictionAir = 0.4;
        }
        this.time.delayedCall(600, () => {
            for (const w of this.wood) {
                if (!w.body) continue;
                this.matter.body.setVelocity(w.body, { x: 0, y: 0 });
                this.matter.body.setAngularVelocity(w.body, 0);
                w.body.frictionAir = 0.08;
            }
        });
    }

    onCollision(event) {
        for (const pair of event.pairs) {
            const a = pair.bodyA;
            const b = pair.bodyB;
            if (!a || !b) continue;
            const la = a.label || "";
            const lb = b.label || "";
            if (la === "ground" || lb === "ground") continue;
            if (la === "wall"   || lb === "wall")   continue;

            // Al golpear madera: liberar inertia para que rote y caiga
            if ((la === "projectile" && lb === "wood") ||
                (lb === "projectile" && la === "wood")) {
                const wb = la === "wood" ? a : b;
                // Liberar inertia = puede rotar libremente al recibir impacto
                if (wb.inertia === Infinity) {
                    wb.inertia = wb.mass * 200;
                    wb.inverseInertia = 1 / wb.inertia;
                }
            }

            // Proyectil + balón = combo
            const hit = (la === "projectile" && lb === "target") ||
                        (lb === "projectile" && la === "target");
            if (hit) {
                if (this.deadIds.has(a.id) || this.deadIds.has(b.id)) continue;
                if (a._hit || b._hit) continue;
                a._hit = true;
                b._hit = true;
                this.toExplode.push({
                    idA: a.id, idB: b.id,
                    mx: (a.position.x + b.position.x) / 2,
                    my: (a.position.y + b.position.y) / 2
                });
            }
        }
    }

    update() {
        // Mantener proyectil en resortera
        if (this.currentBall && !this.isDragging) {
            this.matter.body.setPosition(this.currentBall.body, {
                x: this.slingshotX, y: this.slingshotY
            });
            this.matter.body.setVelocity(this.currentBall.body, { x: 0, y: 0 });
            this.currentBall.gfx.setPosition(this.slingshotX, this.slingshotY);
            this.currentBall.shine.setPosition(this.slingshotX - 5, this.slingshotY - 5);
        }

        // Explosiones
        for (const { idA, idB, mx, my } of this.toExplode) {
            if (this.deadIds.has(idA) || this.deadIds.has(idB)) continue;
            this.explode(mx, my);
            this.killById(idA);
            this.killById(idB);
            this.score += 100;
            this.combos++;
            this.scoreText.setText("Puntos: " + this.score);
            this.comboText.setText("Combos: " + this.combos + " / " + this.combosNeeded);
            if (this.combos >= this.combosNeeded) {
                this.time.delayedCall(600, this.winLevel, [], this);
            }
        }
        this.toExplode = [];

        // Sincronizar balones
        for (const b of this.balls) {
            if (b === this.currentBall) continue;
            if (b.body && b.body.position) {
                b.gfx.setPosition(b.body.position.x, b.body.position.y);
                b.shine.setPosition(b.body.position.x - 5, b.body.position.y - 5);
            }
        }

        // Sincronizar madera
        for (const w of this.wood) {
            if (w.body && w.body.position) {
                w.gfx.setPosition(w.body.position.x, w.body.position.y);
                w.gfx.setRotation(w.body.angle);
                w.brd.setPosition(w.body.position.x, w.body.position.y);
                w.brd.setRotation(w.body.angle);
            }
        }
    }

    killById(id) {
        if (this.deadIds.has(id)) return;
        this.deadIds.add(id);
        const idx = this.balls.findIndex(b => b.body && b.body.id === id);
        if (idx !== -1) {
            this.balls[idx].gfx.destroy();
            this.balls[idx].shine.destroy();
            try { this.matter.world.remove(this.balls[idx].body); } catch(e) {}
            this.balls.splice(idx, 1);
        }
    }

    explode(x, y) {
        const ring = this.add.circle(x, y, 8, 0xffaa00).setDepth(15);
        this.tweens.add({
            targets: ring, scaleX: 7, scaleY: 7, alpha: 0,
            duration: 350, onComplete: () => ring.destroy()
        });
        const txt = this.add.text(x, y - 10, "+100", {
            fontSize: "18px", fill: "#ffff00", fontStyle: "bold"
        }).setOrigin(0.5).setDepth(16);
        this.tweens.add({
            targets: txt, y: y - 70, alpha: 0,
            duration: 700, onComplete: () => txt.destroy()
        });
    }

    winLevel() {
        this.add.rectangle(400, 250, 520, 130, 0x000000, 0.85).setDepth(25);
        this.add.text(400, 225, "¡Nivel Completado!", {
            fontSize: "34px", fill: "#ffff00", fontStyle: "bold"
        }).setOrigin(0.5).setDepth(26);
        this.add.text(400, 272, "Puntos: " + this.score, {
            fontSize: "22px", fill: "#ffffff"
        }).setOrigin(0.5).setDepth(26);
    }
}