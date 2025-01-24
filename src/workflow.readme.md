# Workflow

Let's say that:

- Solid backend is located at: solid.website.com, and
- Your app frontend is located at: website.com

1. The user goes on your frontend app (https://website.com) and clicks on your button connect with Google.
2. The frontend redirects the tab to the backend URL: https://solid.website.com/api/iam/google/connect.
3. The backend redirects the tab to the Google login page where the user logs in.
4. Once done, Google redirects the tab to the backend URL: https://solid.website.com/api/iam/google/connect/callback. When this callback comes, it comes with the users profile & access token.
5. Then, the backend redirects the tab to the url of your choice with the param accessCode (example: http://website.com/connect/google/dummy-redirect?accessCode=eyfvg).
6. The frontend (http://website.com/connect/google/dummy-redirect) calls the backend with https://solid.website.com/api/iam/google/auth?accessCode=eyfvg that returns the Solid user profile with its jwt.
   (Under the hood, the backend asks Google for the user's profile and a match is done on Google user's email address and Solid user's email address).
7. The frontend now possesses the user's jwt, which means the user is connected and the frontend can make authenticated requests to the backend!


# Useful links

- https://medium.com/@flavtech/google-oauth2-authentication-with-nestjs-explained-ab585c53edec
- https://docs.nestjs.com/recipes/passport


ClientId: 210036511862-8mv1rt3s63qj0v8jj3t0gf0l04r1alek.apps.googleusercontent.com
ClientSecret: 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