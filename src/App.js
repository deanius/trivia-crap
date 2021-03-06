import React from 'react';
import './App.css';
import { JoinScreen } from './screens/JoinScreen';
import { LiveScreen } from './screens/LiveScreen';
import { RemoteScreen } from './screens/RemoteScreen';
import { sendToGithubListener, authUrl, authCookieStates } from './auth';
import { simulatedGithubAuth } from './auth/fixtures';
import { setInitialRoute, Home, Live, Remote } from './routes';
import { storeModel } from './store/index';
import { useEffectAtMount } from 'polyrhythm';
import { useChannel, useListener } from './useChannel';
import { useLocalStore, useObserver } from 'mobx-react-lite';

import io from 'socket.io-client';

const url =
  process.env.NODE_ENV === 'production'
    ? document.location.href.replace(/\/\w+$/, '') // get rid of path
    : 'http://localhost:3001';

const authListener =
  process.env.NODE_ENV === 'production'
    ? sendToGithubListener
    : simulatedGithubAuth;

function App({ authStates = authCookieStates, route }) {
  const store = useStore({ authStates, route });
  return useObserver(() => {
    // read, in order to register a dependency
    return (
      <div className="App">
        {store.route === Home && (
          <JoinScreen
            authListener={authListener}
            authUrl={authUrl}
            loggedInUser={store.username}
          />
        )}
        {store.route === Live && (
          <LiveScreen game={store.game} usernames={store.usernames} users={store.users} />
        )}
        {store.route === Remote && <RemoteScreen />}
      </div>
    );
  });
}

function useStore({ authStates, route }) {
  const store = useLocalStore(storeModel);

  const { on, filter, spy, trigger, agentId } = useChannel();

  useAuth({ authStates, store, trigger });

  useEffectAtMount(() => {
    const socket = io(url);
    socket.on('connect', function(...args) {
      console.info(...args);
    });

    // WS events become eventbus events
    socket.on('event', ({ type, payload }) => {
      trigger(type, payload);
    });

    // Certain eventbus events go outbound
    const publishedEvents = ['auth/login'];
    // Add in some fields on the fly for published events
    const agentStamping = filter(publishedEvents, ({ payload }) => {
      payload.agentId = agentId;
    });
    const socketSending = on(publishedEvents, ({ type, payload }) => {
      socket.emit('event', { type, payload });
    });

    // We're initialized properly
    store.setRoute(route || setInitialRoute(window));

    // Debugging
    spy(({ type, payload }) => console.log(type, payload));
    Object.assign(window, { socket, store });

    return () => {
      agentStamping.unsubscribe();
      socketSending.unsubscribe();
      socket.close();
    };
  });

  return store;
}

function useAuth({ authStates, store, trigger }) {
  // Auth states become eventbus events under the key { user }
  useEffectAtMount(() => {
    const sub =
      authStates &&
      authStates.subscribe(user => {
        trigger('auth/login', { user });
      });
    return () => sub && sub.unsubscribe();
  });

  // When we get this event (and we trust it), record our username in the store
  useListener('auth/login', ({ payload: { user } }) => {
    store.setUsername(user);
  });

  useListener('game/update', ({ payload: game }) => {
    for (let key of Object.keys(game)) {
      store[key] = game[key];
    }
  });

  // When we hear of another user joining, we add them to our store
  useListener('game/users/add', ({ payload: { user, photo } }) => {
    store.users[user] = { user, photo };
  });
}
export default App;
