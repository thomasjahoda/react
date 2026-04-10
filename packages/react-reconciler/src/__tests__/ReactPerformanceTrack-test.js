/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

let React;
let ReactNoop;
let Scheduler;
let act;
let useContext;
let useEffect;
let trackingService;
let spanCalls;
let profilingOptions;

describe('ReactPerformanceTracks', () => {
  beforeEach(() => {
    spanCalls = [];
    profilingOptions = {};
    trackingService = {
      isTracking: true,
      startSpan: jest.fn(() => ''),
      createFinishedSpan: jest.fn((...args) => {
        spanCalls.push(args);
        return '';
      }),
      getReactProfilingOptions: jest.fn(() => profilingOptions),
    };
    globalThis.__reactPerformanceTrackingOverride = trackingService;

    Object.defineProperty(performance, 'measure', {
      value: jest.fn(),
      configurable: true,
    });
    console.timeStamp = () => {};
    jest.spyOn(console, 'timeStamp').mockImplementation(() => {});

    jest.resetModules();

    React = require('react');
    ReactNoop = require('react-noop-renderer');
    Scheduler = require('scheduler');
    act = require('internal-test-utils').act;
    useContext = React.useContext;
    useEffect = React.useEffect;
  });

  afterEach(() => {
    delete globalThis.__reactPerformanceTrackingOverride;
  });

  function getSpan(name) {
    for (let i = spanCalls.length - 1; i >= 0; i--) {
      const call = spanCalls[i];
      if (call[0] === name) {
        return call;
      }
    }
    return null;
  }

  // @gate __DEV__ && enableComponentPerformanceTrack
  it('defaults diffPropsOnUpdateMode to shallow and only includes changed prop names', async () => {
    const App = function App({items}) {
      Scheduler.unstable_advanceTime(10);
      useEffect(() => {}, [items]);
      return null;
    };

    const items = ['one', 'two'];
    await act(() => {
      ReactNoop.render(<App items={items} />);
    });

    spanCalls.length = 0;

    await act(() => {
      ReactNoop.render(<App items={items.concat('three')} />);
    });

    expect(getSpan('App')).toEqual([
      'App',
      'ReactComponent',
      10,
      20,
      {
        knownAdditionalData: {
          changedPropertyEntries: [['Changed Props', ''], ['items', '']],
        },
      },
    ]);
  });

  // @gate __DEV__ && enableComponentPerformanceTrack
  it('supports deep prop diffing when diffPropsOnUpdateMode is set to deep', async () => {
    profilingOptions = {
      diffPropsOnUpdateMode: 'deep',
    };

    const App = function App({value}) {
      Scheduler.unstable_advanceTime(10);
      return null;
    };

    await act(() => {
      ReactNoop.render(<App value={1} />);
    });

    spanCalls.length = 0;

    await act(() => {
      ReactNoop.render(<App value={2} />);
    });

    expect(getSpan('App')).toEqual([
      'App',
      'ReactComponent',
      10,
      20,
      {
        knownAdditionalData: {
          changedPropertyEntries: [
            ['Changed Props', ''],
            ['– value', '1'],
            ['+ value', '2'],
          ],
        },
      },
    ]);
  });

  // @gate __DEV__ && enableComponentPerformanceTrack
  it('validates getReactProfilingOptions()', async () => {
    profilingOptions = {
      diffPropsOnUpdateMode: 'invalid',
    };

    function App() {
      return null;
    }

    await expect(
      act(() => {
        ReactNoop.render(<App />);
      }),
    ).rejects.toThrow(
      'getReactProfilingOptions().diffPropsOnUpdateMode must be false, "shallow", or "deep".',
    );
  });

  // @gate __DEV__ && enableComponentPerformanceTrack
  it('does not track changed context display names unless enabled', async () => {
    const ThemeContext = React.createContext('light');
    ThemeContext.displayName = 'ThemeContext';

    function App() {
      const theme = useContext(ThemeContext);
      Scheduler.unstable_advanceTime(10);
      return theme;
    }

    await act(() => {
      ReactNoop.render(
        <ThemeContext value="light">
          <App />
        </ThemeContext>,
      );
    });

    spanCalls.length = 0;

    await act(() => {
      ReactNoop.render(
        <ThemeContext value="dark">
          <App />
        </ThemeContext>,
      );
    });

    expect(getSpan('App')).toEqual([
      'App',
      'ReactComponent',
      10,
      20,
      undefined,
    ]);
  });

  // @gate __DEV__ && enableComponentPerformanceTrack
  it('tracks changed context display names without storing the values when enabled', async () => {
    profilingOptions = {
      diffContextsOnUpdateMode: 'shallow',
    };

    const ThemeContext = React.createContext('light');
    ThemeContext.displayName = 'ThemeContext';

    function App() {
      const theme = useContext(ThemeContext);
      Scheduler.unstable_advanceTime(10);
      return theme;
    }

    await act(() => {
      ReactNoop.render(
        <ThemeContext value="light">
          <App />
        </ThemeContext>,
      );
    });

    spanCalls.length = 0;

    await act(() => {
      ReactNoop.render(
        <ThemeContext value="dark">
          <App />
        </ThemeContext>,
      );
    });

    expect(getSpan('App')).toEqual([
      'App',
      'ReactComponent',
      10,
      20,
      {
        knownAdditionalData: {
          changedContextNames: ['ThemeContext'],
        },
      },
    ]);
  });
});
