navigator.requestMIDIAccess()
  .then((midi) => {
    const handleMsg = msg => {
      const [cmd, note, velocity] = msg.data;

      const round = val => val.toFixed(2);
      const frequency = note => round(Math.pow(2, (note - 69) / 12) * 440) + 'hz';
      const loudness = velocity => round(velocity / 127) * 100 + '%';
      const cmds = {
       '128': 'OFF',
       '144': 'ON',
      };
      const command = cmds[cmd] === 'ON' && velocity === 0 ? 'OFF' : cmds[cmd];

      console.log(command, frequency(note), loudness(velocity));
    };

    for (const input of midi.inputs.values()) {
      input.onmidimessage = handleMsg;
    }

    midi.onstatechange = () => console.log(`${midi.inputs.size} MIDI device(s) connected`);
  }, () => {
    console.log('Failed to access MIDI');
  });
