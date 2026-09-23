const RIZORA_CACHE = "rizora-shell-v4";

self.addEventListener(
  "install",
  event => {

    self.skipWaiting();

    event.waitUntil(
      caches.open(
        RIZORA_CACHE
      ).then(
        cache =>
          cache.addAll([
            "/",
            "/index.html",
            "/rizora-cover.png",
            "/rizora-space.png"
          ]).catch(
            () => {}
          )
      )
    );

  }
);

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(
      caches.keys().then(
        keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !==
                  RIZORA_CACHE
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
      )
    );

    self.clients.claim();

  }
);

self.addEventListener(
  "fetch",
  event => {

    if(
      event.request.method !==
      "GET"
    ){

      return;

    }

    const url =
      new URL(
        event.request.url
      );

    if(
      url.origin !==
      self.location.origin
    ){

      return;

    }

    if(
      url.pathname.startsWith(
        "/api/"
      )
    ){

      return;

    }

    event.respondWith(

      fetch(
        event.request
      )
        .then(
          response => {

            if(
              response.ok
            ){

              const copy =
                response.clone();

              caches.open(
                RIZORA_CACHE
              ).then(
                cache =>
                  cache.put(
                    event.request,
                    copy
                  )
              );

            }

            return response;

          }
        )
        .catch(
          () =>
            caches.match(
              event.request
            )
        )

    );

  }
);
