// A Worker that uses async HTMLRewriter.
//
// In this example, each `img` tag in the HTML body is fetch'd
// on the edge to check if it exists. If the image returns a
// non-200 response, rewrite the `src` attribute to use the
// latest snapshot from the Internet Archive. (https://archive.org)

addEventListener('fetch', event => {
  event.respondWith(fetchWithImageFix(event.request))
})

const cf = {
  cacheEverything: true,
  cacheTtl: 86400, // 1 day
  scrapeShield: false,
  mirage: true,
  polish: 'lossy',
}

async function fetchWithImageFix(request) {
  return new HTMLRewriter()
    .on('img', new ImageFixer())
    .transform(await fetch(request))
}

class ImageFixer {
  // The `async` keyword enables async/await for this handler.
  async element(element) {
    var src = element.getAttribute('src')
    if (!src) {
      src = element.getAttribute('data-cfsrc')
      element.removeAttribute('data-cfsrc')
    }

    // Rewrite the URL with the fixed image.
    if (src) {
      element.setAttribute('src', await fixImageUrl(src))
    }
  }
}

async function fixImageUrl(url) {
  if (url.startsWith('/')) {
    return url
  }

  var response = await fetch(url.toString(), { method: 'HEAD', cf })
  if (response.ok || response.status === 405) {
    return response.url
  }

  var archive = await fetch(`https://archive.org/wayback/available?url=${url}`, { cf })
  try {
    var json = await archive.json()
    var archiveUrl = new URL(json.archived_snapshots.closest.url)
    var index = archiveUrl.pathname.indexOf('http')

    // Insert `im_` to archived URL so it renders as an image.
    archiveUrl.pathname =
      archiveUrl.pathname.substring(0, index - 1) +
      'im_' +
      archiveUrl.pathname.substring(index)
    console.log('Fixed image: ' + archiveUrl)

    return archiveUrl
  } catch (err) {
    console.log('Missing image: ' + url)
    return response.url
  }
}
