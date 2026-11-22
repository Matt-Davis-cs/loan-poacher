// Builds the post a student can share once they got a loan. It only ever takes the message and the app's link, so
// nothing about the student's finances can end up in the post.

const X_NEW_POST_ADDRESS = "https://x.com/intent/post";

// The address other people can open the app from, or null when this copy is only on the student's own computer.
function publicAppLink(pageAddress) {
  try {
    const page = new URL(pageAddress);
    return page.protocol === "https:" ? page.origin + page.pathname : null;
  } catch {
    return null;
  }
}

// Opens X's new post screen with the text filled in; nothing is posted until the student presses Post there.
function xShareUrl(message, appLink) {
  const linkPart = appLink === null ? "" : `&url=${encodeURIComponent(appLink)}`;
  return `${X_NEW_POST_ADDRESS}?text=${encodeURIComponent(message)}${linkPart}`;
}

// Instagram can't take a ready-filled post from a website, so the student gets the same message as a caption to paste.
const INSTAGRAM_ADDRESS = "https://www.instagram.com/";

function instagramCaption(message, appLink) {
  return appLink === null ? message : `${message}\n\n${appLink}`;
}

if (typeof module !== "undefined") {
  module.exports = { instagramCaption, publicAppLink, xShareUrl };
}
