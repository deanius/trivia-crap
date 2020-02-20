import React, { useEffect } from 'react';
import './App.css';
import { JoinScreen } from './screens/JoinScreen';
import { simulatedGithubAuth } from './auth/fixtures';
import { sendToGithubListener, authUrl } from './auth';
import { spy, on, trigger } from 'polyrhythm';

import io from 'socket.io-client';

const url =
  process.env.NODE_ENV === 'production'
    ? document.location.href.replace(/\/\w+$/, '') // get rid of path
    : 'http://localhost:3001';

const authListener =
  process.env.NODE_ENV === 'production'
    ? sendToGithubListener
    : simulatedGithubAuth;

function App() {
  useEffect(() => {
    spy(({ type, payload }) => console.log(type, payload));
    const socket = io(url);

    socket.on('connect', function() {
      socket.emit('helo', 'helo');
    });

    const socketEvents = ['auth/login'];
    on(socketEvents, ({ type, payload }) => {
      socket.emit('event', { type, payload });
    });

    window.socket = socket;
    window.trigger = trigger;
  }, []);
  return (
    <div className="App">
      <JoinScreen authListener={authListener} authUrl={authUrl} />
    </div>
  );
}

export default App;
