/**
 * @author mrdoob / http://mrdoob.com/
 * @author schteppe / https://github.com/schteppe
 */
var PointerLockControls = function (camera, cannonBody) {

    var eyeYPos = 20; // eyes are 2 meters above the ground
    var velocityFactor = 1;
    var jumpVelocity = 20;
    var scope = this;

    var pitchObject = new THREE.Object3D();
    pitchObject.add(camera);

    var yawObject = new THREE.Object3D();
    yawObject.position.y = 2;
    yawObject.add(pitchObject);
    yawObject.rotation.y = Math.PI; // looking north

    var quat = new THREE.Quaternion();

    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;

    var canJump = false;

    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0, 1, 0);
    cannonBody.addEventListener("collide", function (e) {
        var contact = e.contact;

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if (contact.bi.id == cannonBody.id)  // bi is the player body, flip the contact normal
            contact.ni.negate(contactNormal);
        else
            contactNormal.copy(contact.ni); // bi is something else. Keep the normal as it is

        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if (contactNormal.dot(upAxis) > 0.5) // Use a "good" threshold value between 0 and 1 here!
            canJump = true;
    });

    var velocity = cannonBody.velocity;

    var PI_2 = Math.PI / 2;

    var onMouseMove = function (event) {

        if (scope.enabled === false) return;

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max(- PI_2, Math.min(PI_2, pitchObject.rotation.x));
    };

    var onKeyDown = function (event) {
        switch (event.code) {

            case "ArrowUp":
            case "KeyW": // w (QWERTY) / z (AZERTY)
                moveForward = true;
                break;

            case "ArrowLeft":
            case "KeyA": // a (QWERTY) / q (AZERTY)
                moveLeft = true;
                break;

            case "ArrowDown":
            case "KeyS": // s (QWERTY) / s (AZERTY)
                moveBackward = true;
                break;

            case "ArrowRight":
            case "KeyD": // d (QWERTY) / d (AZERTY)
                moveRight = true;
                break;

            case "KeyR":
                fill = "r";
                break;

            case "Space": // space (saut)
                if (canJump === true) {
                    velocity.y = jumpVelocity;
                }
                canJump = false;
                break;

            // a=65 w=87 g=71
            case "KeyQ":
                sphereBody.mass = 0;
                velocity.y = 10;
                canJump = false;
                break;

            case "KeyZ":
                sphereBody.mass = 0;
                velocity.y = -10;
                canJump = false;
                break;

            case "KeyG":
                sphereBody.mass = 100;
                break;

            case "ControlLeft": // Ctrl gauche
                ctrl = true;
                document.getElementById('crosshair').style.backgroundImage =
                    'url("http://pierrepapierciseaux.net/atelier/web%20voxel/img/pinceau.png")';
                break;

            case "AltLeft": // Alt gauche
                alt = true;
                document.getElementById('crosshair').style.backgroundImage =
                    'url("http://pierrepapierciseaux.net/atelier/web%20voxel/img/pipette.png")';
                break;
        }
    };

    var onKeyUp = function (event) {
        switch (event.code) {

            case "ArrowUp":
            case "KeyW": // w (QWERTY) / z (AZERTY)
                moveForward = false;
                break;

            case "ArrowLeft":
            case "KeyA": // a (QWERTY) / q (AZERTY)
                moveLeft = false;
                break;

            case "ArrowDown":
            case "KeyS": // s (QWERTY) / s (AZERTY)
                moveBackward = false;
                break;

            case "ArrowRight":
            case "KeyD": // d (QWERTY) / d (AZERTY)
                moveRight = false;
                break;

            case "KeyQ":
                sphereBody.velocity.y = 0;
                break;

            case "KeyZ":
                sphereBody.velocity.y = 0;
                break;

            case "ControlLeft":
                ctrl = false;
                document.getElementById('crosshair').style.backgroundImage =
                    'url("./img/crosshair.png")';
                break;

            case "AltLeft":
                alt = false;
                document.getElementById('crosshair').style.backgroundImage =
                    'url("./img/crosshair.png")';
                break;
        }
        if (event.key === "m" || event.key === "M") {
            toggleMass();
        }
        if (event.key === "l" || event.key === "L") {
            refresh();
        }
    };


    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    this.enabled = false;

    this.getObject = function () {
        return yawObject;
    };

    this.getDirection = function (targetVec) {
        targetVec.set(0, 0, -1);
        quat.multiplyVector3(targetVec);
    }

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    var euler = new THREE.Euler();
    this.update = function (delta) {

        //if (scope.enabled === false) return;

        delta *= 1;

        inputVelocity.set(0, 0, 0);

        if (moveForward) {
            inputVelocity.z = -velocityFactor * delta;
        }
        if (moveBackward) {
            inputVelocity.z = velocityFactor * delta;
        }

        if (moveLeft) {
            inputVelocity.x = -velocityFactor * delta;
        }
        if (moveRight) {
            inputVelocity.x = velocityFactor * delta;
        }

        // Convert velocity to world coordinates
        euler.x = pitchObject.rotation.x;
        euler.y = yawObject.rotation.y;
        euler.order = "XYZ";
        quat.setFromEuler(euler);
        inputVelocity.applyQuaternion(quat);
        //quat.multiplyVector3(inputVelocity);

        // Add to the object
        velocity.x = inputVelocity.x;
        velocity.z = inputVelocity.z;

        yawObject.position.copy(cannonBody.position);

    };
};
