// static/js/pfp_cropper.js

// Ensure DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    const avatarInput = document.querySelector('input[name="avatar"]');

    if (!avatarInput) return;

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => openCropModal(reader.result);
        reader.readAsDataURL(file);
    });
});

function openCropModal(imageSrc) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'cropper-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.background = '#222';
    modal.style.padding = '20px';
    modal.style.borderRadius = '12px';
    modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <h2 style="color:white; text-align:center; margin-bottom:10px;">Adjust Your Profile Picture</h2>
        <img id="crop-image" src="${imageSrc}" style="max-width:300px; max-height:300px; display:block; margin:0 auto; border-radius:50%;" />
        <div style="text-align:center; margin-top:15px;">
            <button id="crop-confirm" style="margin-right:10px; padding:6px 12px;">Confirm</button>
            <button id="crop-cancel" style="padding:6px 12px;">Cancel</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('crop-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    document.getElementById('crop-confirm').addEventListener('click', () => {
        // In real implementation, you'd extract cropped image here
        document.body.removeChild(overlay);
        alert('Crop confirmed! (Not implemented yet)');
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const avatarInput = document.querySelector('input[name="avatar"]');
    const cropModal = document.getElementById("CropperModal");
    const cropperImage = document.getElementById("CropperImage");
    const cropBtn = document.getElementById("CroppercropBtn");
    const cancelBtn = document.getElementById("CropperCancelBtn");

    let cropper = null;

    avatarInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file && /^image\//.test(file.type)) {
            const reader = new FileReader();
            reader.onload = function (event) {
                cropperImage.src = event.target.result;
                cropModal.style.display = "flex";
                if (cropper) {
                    cropper.destroy();
                }
                cropper = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    background: false,
                    dragMode: "move",
                    guides: false,
                    scalable: false,
                    zoomable: true,
                    rotatable: false,
                });
            };
            reader.readAsDataURL(file);
        }
    });

    cropBtn.addEventListener("click", function () {
        if (cropper) {
            cropper.getCroppedCanvas({ width: 256, height: 256 }).toBlob((blob) => {
                const formData = new FormData(document.querySelector("form"));
                formData.set("avatar", blob, "cropped_avatar.png");

                fetch("/profile", {
                    method: "POST",
                    body: formData,
                })
                    .then((response) => {
                        if (response.redirected) {
                            window.location.href = response.url;
                        }
                    })
                    .catch((error) => {
                        console.error("Upload failed:", error);
                    });
            });
        }
    });

    cancelBtn.addEventListener("click", function () {
        cropModal.style.display = "none";
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        avatarInput.value = "";
    });
});
