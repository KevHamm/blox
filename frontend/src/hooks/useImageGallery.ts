import { useState } from "react";

export type GalleryImage = { id: string; src: string; name: string };

/**
 * The right-sidebar image gallery: the uploaded images (stored as data URLs so
 * they survive save/reload) plus the upload-and-remove handlers and the
 * "files are over the drop zone" flag.
 */
export function useImageGallery(initial: GalleryImage[] = []) {
  const [images, setImages] = useState<GalleryImage[]>(() => initial);
  // True while OS files are being dragged over the right sidebar (drop to upload).
  const [imageDropActive, setImageDropActive] = useState(false);

  function deleteImageUpload(imageId: string) {
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  // Read one or more image files into the gallery (shared by the upload button
  // and by dropping files onto the sidebar).
  function addImageFiles(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setImages((prev) => [...prev, { id: crypto.randomUUID(), src: url, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e: any) => {
      if (e.target.files?.length) addImageFiles(e.target.files);
    };
    input.click();
  }

  return {
    images,
    imageDropActive,
    setImageDropActive,
    addImageFiles,
    uploadImage,
    deleteImageUpload
  };
}
