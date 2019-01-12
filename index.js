let settings, synth;

const waveforms = ['sine', 'square', 'triangle', 'sawtooth'];

const saveSettings = (newSettings) => {
  // TODO: since this is called on input, debounce to limit number of times we access storage
  const settings = JSON.parse(localStorage.getItem('settings'));
  Object.assign(settings, newSettings);
  localStorage.setItem('settings', JSON.stringify(settings));
};

const setVolume = (newVolume) => {
  newVolume = Number(newVolume);
  // adjust gain for human logarithmic hearing
  let gain = Math.pow(newVolume, 2);
  // adjust gain for perceived loudness of different waveforms
  const waveform = synth.voices[0].waveform();
  waveform === 'square' ? gain *= 0.65
  : waveform === 'sawtooth' ? gain *= 0.85
  : waveform === 'sine' ? gain *= 0.95
  : gain *= 1;

  synth.maxGain(gain);
  const volumeText = (newVolume * 100).toFixed(0);
  $('#volumeLabel').text(volumeText);
  saveSettings({volume: newVolume});
};

const setAttack = (newAttack) => {
  newAttack = Number(newAttack);
  synth.attack(newAttack);
  const attackText = (newAttack * 1000).toFixed(0);
  $('#attackLabel').text(attackText);
  saveSettings({attack: newAttack});
};

const setDecay = (newDecay) => {
  newDecay = Number(newDecay);
  synth.decay(newDecay);
  const decayText = (newDecay * 1000).toFixed(0);
  $('#decayLabel').text(decayText);
  saveSettings({decay: newDecay});
};

const setSustain = (newSustain) => {
  newSustain = Number(newSustain);
  const adjustedSustain = Math.pow(newSustain, 2);
  synth.sustain(adjustedSustain);
  const sustainText = (newSustain * 1).toFixed(2);
  $('#sustainLabel').text(sustainText);
  saveSettings({sustain: newSustain});
};

const setRelease = (newRelease) => {
  newRelease = Number(newRelease);
  synth.release(newRelease);
  const releaseText = (newRelease * 1000).toFixed(0);
  $('#releaseLabel').text(releaseText);
  saveSettings({release: newRelease});
};

const cutoff = {
  setMaxFrequency(newMaxFrequency) {
    newMaxFrequency = Number(newMaxFrequency);
    synth.cutoff.maxFrequency(newMaxFrequency);
    const maxFrequencyText = newMaxFrequency;
    $('#cutoffMaxFrequencyLabel').text(maxFrequencyText);
    saveSettings({cutoff: {maxFrequency: newMaxFrequency}});
  },
  setAttack(newAttack) {
    newAttack = Number(newAttack);
    synth.cutoff.attack(newAttack);
    const attackText = (newAttack * 1000).toFixed(0);
    $('#cutoffAttackLabel').text(attackText);
    saveSettings({cutoff: {attack: newAttack}});
  },
  setDecay(newDecay) {
    newDecay = Number(newDecay);
    synth.cutoff.decay(newDecay);
    const decayText = (newDecay * 1000).toFixed(0);
    $('#cutoffDecayLabel').text(decayText);
    saveSettings({cutoff: {decay: newDecay}});
  },
  setSustain(newSustain) {
    newSustain = Number(newSustain);
    synth.cutoff.sustain(newSustain);
    const sustainText = (newSustain * 1).toFixed(2);
    $('#cutoffSustainLabel').text(sustainText);
    saveSettings({cutoff: {sustain: newSustain}});
  }
};

const setKey = (newKey) => {
  settings.key = newKey = Number(newKey);

  // TODO: "Key" can just be a note shift (+1, +2, etc.).
  const getKeyLabel = () => {
    const keys = [
      { label: 'G', value: 35 },
      { label: 'G#', value: 36 },
      { label: 'A', value: 37 },
      { label: 'A#', value: 38 },
      { label: 'B', value: 39 },
      { label: 'C', value: 40 },
      { label: 'C#', value: 41 },
      { label: 'D', value: 42 },
      { label: 'D#', value: 43 },
      { label: 'E', value: 44 },
      { label: 'F', value: 45 },
      { label: 'F#', value: 46 }
    ];
    const key = keys.find(k => k.value === newKey);

    return key.label;
  };

  const keyText = getKeyLabel();
  $('#keyLabel').text(keyText);
  saveSettings({key: newKey});
};

// TODO: Make this work.
const setOctave = (newOctave) => {
  settings.octave = newOctave = Number(newOctave);
  const octaveText = newOctave > 0 ? '+' + newOctave : newOctave;
  $('#octaveLabel').text(octaveText);
  saveSettings({octave: newOctave});
};

// TODO: Decide if you like the new way width works.
// (You could change it to position only notes that are currently ON.)
const setWidth = (newWidth) => {
  newWidth = Number(newWidth);
  synth.width(newWidth);
  const widthText = (newWidth * 100).toFixed(0);
  $('#widthLabel').text(widthText);
  saveSettings({stereoWidth: newWidth});
};

const setWaveform = (newWaveform) => {
  synth.waveform(newWaveform);
  setVolume($('#volumeSlider').val()); // adjust for perceived loudness of waveform
  waveforms.forEach(function(waveform) {
    $('#' + waveform + 'Button').removeClass('on');
  });
  $('#' + newWaveform + 'Button').addClass('on');
  saveSettings({waveform: newWaveform});
};

// reload page w/o POST
const panic = () => {
  window.location = window.location;
};

// initialize synth, controls and control panel
(() => {
  const getAudioContext = () =>
    typeof AudioContext === 'undefined' ? new webkitAudioContext() : new AudioContext();

  let audioCtx = getAudioContext();

  // Click anywhere in the page to enable sound.
  document.onclick = () => audioCtx.resume();

  // Last-note priority with 16 voices.
  let voiceIndex = -1;
  const nextVoice = () => {
    voiceIndex = voiceIndex === 15 ? 0 : voiceIndex + 1;
    return voiceIndex;
  }

  navigator.requestMIDIAccess()
    .then((midi) => {
      const handleMsg = (msg) => {
        const [cmd, note, velocity] = msg.data;
        const round = val => val.toFixed(2);
        const frequency = note => Math.pow(2, (note - 69) / 12) * 440;
        const loudness = velocity => (velocity / 127) * 100;
        const command =
          cmd >= 128 && cmd < 144 ? 'OFF' // Channel is cmd - 128
          : cmd >= 144 && cmd < 160 ? 'ON' // Channel is cmd - 144
          : 'UNKNOWN';

        console.log(`${command} ${round(frequency(note))}hz ${round(loudness(velocity))}%`);

        // Play the notes!
        if (command === 'ON') {
          const voiceIndex = nextVoice();
          const voice = synth.voices[voiceIndex];
          voice.pitch(frequency(note));
          voice.note = note;
          voice.start();
        } else {
          synth.voices
            .filter(v => v.note === note)
            .forEach(v => v.stop());
        }
      };

      for (const input of midi.inputs.values()) {
        input.onmidimessage = handleMsg;
      }

      midi.onstatechange = () => console.log(`${midi.inputs.size} MIDI device(s) connected`);
    }, () => {
      console.log('Failed to access MIDI');
    });

  // enable sound on mobile systems like iOS; code from Howler.js
  (() => {
    if (audioCtx !== 44100) {
      audioCtx.close();
      audioCtx = getAudioContext();
    }

    const scratchBuffer = audioCtx.createBuffer(1, 1, 22050);

    const unlock = () => {
      const source = audioCtx.createBufferSource();
      source.buffer = scratchBuffer;
      source.connect(audioCtx.destination);

      source.start === 'undefined' ? source.noteOn(0) : source.start(0);

      source.onended = () => {
        source.disconnect(0);
        document.removeEventListener('touchend', unlock, true);
      };
    };

    document.addEventListener('touchend', unlock, true);
  })();

  const getSettings = () => {
    let settings = JSON.parse(localStorage.getItem('settings'));
    if (!settings) {
      // load and save defaults
      settings = {
        key: 40, // C
        octave: -1,
        waveform: 'sawtooth',
        volume: 0.9,
        numVoices: 16,
        stereoWidth: 1,
        attack: 0.28,
        decay: 0.28,
        sustain: 1,
        release: 0.28,
        cutoff: {
          maxFrequency: 1800,
          attack: 0.1,
          decay: 2.5,
          sustain: 0.2
        }
      };
      localStorage.setItem('settings', JSON.stringify(settings));
    }
    return settings;
  };

  settings = getSettings();
  synth = new Polysynth(audioCtx, settings);
  console.log('yor synth!', synth);

  // update controls to display initial synth values
  $('#keySlider').val(settings.key); // not a subpoly or submono property
  $('#octaveSlider').val(settings.octave); // not a subpoly or submono property
  $('#widthSlider').val(synth.width());

  const voice = synth.voices[0];
  $('#volumeSlider').val(settings.volume); // volume != gain
  $('#attackSlider').val(voice.attack);
  $('#decaySlider').val(voice.decay);
  $('#sustainSlider').val(voice.sustain);
  $('#releaseSlider').val(voice.release);
  $('#cutoffFrequencySlider').val(voice.cutoff.maxFrequency);
  $('#cutoffAttackSlider').val(voice.cutoff.attack);
  $('#cutoffDecaySlider').val(voice.cutoff.decay);
  $('#cutoffSustainSlider').val(voice.cutoff.sustain);
  $('#waveformSelect').val(voice.waveform());

  // update labels to display initial synth values
  $('#settingsPanel input').trigger('input');
  $('#settingsPanel select').change();

  // prevent browser default behavior on touch/click of buttons
  $('button').on('touchstart mousedown', (e) => {
    e.preventDefault();
  });

  // build waveform menu
  (() => {
    const settingsButton = $('#waveformMenu .settings');
    const preventDefault = (e) => {
      e.preventDefault();
    };

    waveforms.forEach((waveform) => {
      const selectWaveform = (e) => {
        e.preventDefault();
        setWaveform(waveform);
      };

      $('<button/>', {
        id: waveform + 'Button',
        html: '&nbsp;',
        mousedown: preventDefault,
        click: selectWaveform
      })
        .bind('touchstart', preventDefault)
        .bind('touchend', selectWaveform)
        .insertBefore(settingsButton)
      ;
    });
    $('#' + settings.waveform + 'Button').click();
  })();
})();
