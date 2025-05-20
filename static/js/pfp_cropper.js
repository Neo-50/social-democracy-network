let cropper;

document.addEventListener("DOMContentLoaded", function () {
    const avatarInput = document.querySelector('input[name="avatar"]');
    const cropModal = document.getElementById("cropperModal");
    const cropperImage = document.getElementById("cropperImage");
    const cropBtn = document.getElementById("cropButton");
    const cancelBtn = document.getElementById("cancelCropButton");

    avatarInput.addEventListener("change", function () {
        const file = this.files[0];
        if (file && /^image\/(png|jpeg|jpg|gif)$/.test(file.type)) {
            const reader = new FileReader();
            reader.onload = function (e) {
                cropperImage.src = e.target.result;
                cropModal.style.display = "flex";

                // Destroy existing cropper if any
                if (cropper) {
                    cropper.destroy();
                }

                // Initialize Cropper.js
                cropper = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    guides: false,
                    center: true,
                    highlight: false,
                    background: false,
                    cropBoxMovable: false,
                    cropBoxResizable: false,
                    movable: true,
                    zoomable: true
                });
            };
            reader.readAsDataURL(file);
        }
    });

    cropBtn.addEventListener("click", function () {
        if (cropper) {
            cropper.getCroppedCanvas({ width: 256, height: 256 }).toBlob(blob => {
                const form = document.querySelector("form");
                const formData = new FormData(form);
                formData.set("avatar", blob, "cropped_avatar.png");

                fetch("/profile", {
                    method: "POST",
                    body: formData
                })
                    .then(response => {
                        if (response.redirected) {
                            window.location.href = response.url;
                        }
                    })
                    .catch(error => {
                        console.error("Upload failed:", error);
                    })
                    .finally(() => {
                        cropper.destroy();
                        cropModal.style.display = "none";
                    });
            });
        }
    });

    cancelBtn.addEventListener("click", function () {
        if (cropper) {
            cropper.destroy();
        }
        cropModal.style.display = "none";
        avatarInput.value = ""; // reset file input
    });
});
