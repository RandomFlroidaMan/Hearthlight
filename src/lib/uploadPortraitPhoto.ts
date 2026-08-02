/** Shared by CharacterForm (a new character's optional photo) and
 * PortraitPhotoUpload (adding/replacing a photo for an existing
 * character) — one place for the fetch + error-shape handling instead of
 * duplicating it in two client components. */
export async function uploadPortraitPhoto(
  characterId: string,
  file: File,
): Promise<{ ok: true; portraitPath: string } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("photo", file);

  const res = await fetch(`/api/characters/${characterId}/portrait/photo`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, message: json.message ?? "That photo couldn't be turned into a portrait." };
  }
  return { ok: true, portraitPath: json.portraitPath };
}
