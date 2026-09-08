/**
 * ============================================================================
 * UNKNOWN-SIGNAL // EDITABLE DATASET: GALLERY MEDIA
 * File: edits_gallery_media.js
 * ============================================================================
 * 
 * QUICK GUIDE - HOW TO ADD A NEW PHOTO TO THE GALLERY:
 * 1. Copy the blank template below.
 * 2. Paste it anywhere inside the EDITS_GALLERY_MEDIA array below.
 * 3. Fill in the title, date, status, description, and image path/URL.
 * 4. Save and commit this file to GitHub. The gallery will update automatically!
 * 
 * ----------------------------------------------------------------------------
 * COPY-PASTE TEMPLATE FOR NEW GALLERY PHOTO:
 * ----------------------------------------------------------------------------
 * {
 *   id: "gal-custom-01",
 *   title: "PHOTO TITLE",
 *   date: "2026-04-15",               // Date or "UNKNOWN"
 *   status: "UNRESOLVED",             // "UNRESOLVED" (Orange) | "CONFIRMED" (Green) | "CLASSIFIED" (Red)
 *   image: "images/gallery/your-photo.jpg", // File in images/gallery/ or an HTTPS URL
 *   description: "Description of the surveillance imagery, camera pod, or witness capture."
 * },
 * ============================================================================
 */

const EDITS_GALLERY_MEDIA = [
  {
    id: "gal-01",
    title: "FBI DIGITAL RENDERING D038",
    name: "FBI DIGITAL RENDERING D038",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/FBI-UAP-D038_Digital-Rendering-1_Multiple-Red-Lights_2026.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-02",
    title: "FBI DIGITAL RENDERING D041",
    name: "FBI DIGITAL RENDERING D041",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/FBI-UAP-D041_Digital-Rendering-1_Multiple-Red-Lights_2026.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-03",
    title: "LUBBOCK LIGHTS FORMATION",
    name: "LUBBOCK LIGHTS FORMATION",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/Lubbock-Lights-UFO_1024x1024.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-04",
    title: "PHOENIX LIGHTS OVERFLIGHT",
    name: "PHOENIX LIGHTS OVERFLIGHT",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/PHOENIX LIGHTS.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-05",
    title: "UAP OBSERVATORY ARCHIVE #1",
    name: "UAP OBSERVATORY ARCHIVE #1",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/3994c5d06c599e8194152b7bd10fd7bc.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-06",
    title: "TACTICAL RADAR TELEMETRY",
    name: "TACTICAL RADAR TELEMETRY",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/Screenshot 2026-08-25 090837.png",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-07",
    title: "ORBITAL TRACKING DISPLAY",
    name: "ORBITAL TRACKING DISPLAY",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/Screenshot 2026-08-25 100509.png",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-08",
    name: "ORBITAL TRACKING DISPLAY",
    title: "ORBITAL TRACKING DISPLAY",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/ChatGPT Image Aug 25, 2026, 09_51_55 AM.png",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  },
  {
    id: "gal-09",
    title: "OBSERVATORY MEDIA ARCHIVE #2",
    name: "OBSERVATORY MEDIA ARCHIVE #2",
    date: "UNKNOWN",
    status: "UNRESOLVED",
    image: "images/gallery/images.jpg",
    description: "Low-quality surveillance imagery showing multiple unidentified aerial contacts. The original location, date, and source of the recording remain unverified."
  }
];

// Universal Exports (Browser Window + Node Environments)
if (typeof window !== "undefined") {
  window.EDITS_GALLERY_MEDIA = EDITS_GALLERY_MEDIA;
  window.GALLERY_IMAGES = EDITS_GALLERY_MEDIA;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = EDITS_GALLERY_MEDIA;
}
