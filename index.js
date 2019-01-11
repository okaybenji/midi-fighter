const audioCtx = new AudioContext();
const synth = new Monosynth(audioCtx);

// Click anywhere in the page to enable sound.
document.onclick = () => {
  audioCtx.resume();
  document.onclick = undefined;
};

navigator.requestMIDIAccess()
  .then((midi) => {
    const handleMsg = (msg) => {
      const [cmd, note, velocity] = msg.data;

      const round = val => val.toFixed(2);
      const frequency = note => Math.pow(2, (note - 69) / 12) * 440;
      const loudness = velocity => (velocity / 127) * 100;
      const cmds = {
       '128': 'OFF',
       '144': 'ON',
      };
      const command = cmds[cmd] === 'ON' && velocity === 0 ? 'OFF' : cmds[cmd];

      console.log(`${command} ${round(frequency(note))}hz ${round(loudness(velocity))}%`);

      // Play the notes!
      if (command === 'ON') {
        synth.pitch(frequency(note));
        synth.start();
      } else {
        synth.stop();
      }
    };

    for (const input of midi.inputs.values()) {
      input.onmidimessage = handleMsg;
    }

    midi.onstatechange = () => console.log(`${midi.inputs.size} MIDI device(s) connected`);
  }, () => {
    console.log('Failed to access MIDI');
  });
