let settings, synth;

const scale = (num, inMin, inMax, outMin, outMax) =>
  (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

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
    const maxFrequencyText = Math.round(newMaxFrequency);
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

const setBendRange = (newBendRange) => {
  settings.bendRange = newBendRange = Number(newBendRange);
  $('#bendLabel').text(newBendRange);
  saveSettings({bendRange: newBendRange});
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

  if (typeof navigator.requestMIDIAccess === 'function') {
    navigator.requestMIDIAccess()
      .then((midi) => {
        const handleMsg = (msg) => {
          const [cmd, , val] = msg.data;
          const round = val => val.toFixed(2);
          const frequency = note => Math.pow(2, (note - 69) / 12) * 440;
          const normalize = val => val / 127;
          // Command range represents 16 channels
          const command =
            cmd >= 128 && cmd < 144 ? 'off'
            : cmd >= 144 && cmd < 160 && val === 0 ? 'off'
            : cmd >= 144 && cmd < 160 ? 'on'
            : cmd >= 224 && cmd < 240 ? 'pitch'
            : cmd >= 176 && cmd < 192 ? 'ctrl'
            : 'unknown';

          const exec = {
            off() {
              const [, note, velocity] = msg.data;
              synth.voices
                .filter(v => v.note === note + (settings.octave * 12))
                .forEach(v => v.stop());
              console.log(`${command} ${note}`);
            },
            on() {
              const [, note, velocity] = msg.data;
              const octave = settings.octave * 12;
              console.log(note, velocity);
              const voiceIndex = nextVoice();
              const voice = synth.voices[voiceIndex];
              voice.pitch(frequency(note + octave));
              voice.note = note + octave;
              voice.start();
              console.log(`${command} ${note} ${round(normalize(velocity) * 100)}%`);
            },
            pitch() {
              const [, , strength] = msg.data;
              const mappedStrength = scale(strength, 0, 127, -1, 1) * settings.bendRange / 12;
              const multiplier = Math.pow(2, mappedStrength);

              synth.voices.forEach(v => v.note && v.pitch(frequency(v.note) * multiplier));
              console.log(synth.voices[0].pitch());
            },
            ctrl() {
              // Controllers such as mod wheel, aftertouch, breath add vibrato.
              const [, , strength] = msg.data;
              synth.lfo.depth(normalize(strength) * 10);
              cutoff.setMaxFrequency(7500 + normalize(strength) * 10000);
            },
            unknown() {
              //console.log(msg.data);
            }
          };

          exec[command]();
        };

        for (const input of midi.inputs.values()) {
          input.onmidimessage = handleMsg;
        }

        midi.onstatechange = () => console.log(`${midi.inputs.size} MIDI device(s) connected`);
      }, () => {
        console.log('Failed to access MIDI');
      });
  } else {
    console.log('Your browser does not support the Web MIDI API');
  }

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
        bendRange: 2, // In semitones
        octave: 0,
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

  // update controls to display initial synth values
  $('#bendSlider').val(settings.bendRange); // not a subpoly or submono property
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
