
/**
 * Menhera Provisionality -- minimal Web frontend framework
 * Copyright (C) 2021 Menhera.org
 * https://github.com/menhera-org/Provisionality
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * @file
 */


/**
 * 
 * @param callback {function}
 * @param args {any[]}
 */
const callAsync = (callback, ... args) => {
    Promise.resolve()
    .then(() => callback(... args))
    .catch(e => console.error(e));
};

const randomUuid = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = bytes[6] & 0x0f ^ 0x40;
    bytes[8] = bytes[8] & 0x3f ^ 0x80;
    const hex = Array.prototype.map.call(
        bytes,
        byte => (byte | 0x100).toString(0x10).slice(-2)
    ).join('');
    return [
        hex.substr(0, 8),
        hex.substr(8, 4),
        hex.substr(12, 4),
        hex.substr(16, 4),
        hex.substr(20, 12),
    ].join('-');
};

const isConstructor = f => {
    try {
        Reflect.construct(String, [], f);
        return true;
    } catch (e) {
        return false;
    }
};

const statesByClass = new WeakMap;
const internalStates = {};
export class InternalStateStore {
    constructor(constructor) {
        const internalState = Object.create(null);
    }
}

const storageStates = new WeakMap;
export class KeyValueStorageImplementation {
    constructor() {
        super();
        const state = {
            values: new Map,
            observers: new Map,
        };
        storageStates.set(this, state);
    }

    has(key) {
        const state = storageStates.get(this);
        return!!state.values.has(String(key));
    }

    set(key, value) {
        const state = storageStates.get(this);
        const stringKey = String(key);
        state.values.set(stringKey, JSON.stringify(value));
        if (!state.observers.has(stringKey)) {
            return;
        }
        for (const observer of state.observers.get(stringKey)) {
            observer(this.get(stringKey));
        }
    }

    get(key) {
        const state = storageStates.get(this);
        return JSON.parse(state.values.get(String(key)));
    }

    addObserver(key, callback) {
        const stringKey = String(key);
        if ('function' != typeof callback) {
            throw new TypeError('Not a function');
        }
        const state = storageStates.get(this);
        if (!state.observers.has(stringKey)) {
            state.observers.set(stringKey, new Set);
        }
        state.observers.get(stringKey).add(callback);
    }

    removeObserver(key, callback) {
        const stringKey = String(key);
        if ('function' != typeof callback) {
            throw new TypeError('Not a function');
        }
        const state = storageStates.get(this);
        if (!state.observers.has(stringKey)) {
            return;
        }
        const set = state.observers.get(stringKey);
        set.delete(callback);
        if (!set.size) {
            state.observers.delete(stringKey);
        }
    }
}

const topicStates = new WeakMap;
export class Topic {
    constructor() {
        const listeners = new Set;
        topicStates.set(this, listeners);
    }

    /**
     * 
     * @param listener {(data: *) => Promise<void>}
     */
    addListener(listener) {
        if ('function' != typeof listener) {
            throw new TypeError('Not a function');
        }
        const listeners = topicStates.get(this);
        listeners.add(listener);
    }

    /**
     * 
     * @param listener {(data: *) => Promise<void>}
     */
    removeListener(listener) {
        if ('function' != typeof listener) {
            throw new TypeError('Not a function');
        }
        const listeners = topicStates.get(this);
        listeners.delete(listener);
    }

    /**
     * 
     * @param data {*}
     */
    dispatchMessage(data) {
        const listeners = topicStates.get(this);
        for (const listener of listeners) {
            callAsync(listener, data);
        }
    }
}

const propertyStates = new WeakMap;
export class Property {
    /**
     * 
     * @param value {*}
     */
    constructor(value) {
        const propertyState = {
            jsonValue: JSON.stringify(value),
        };
        propertyStates.set(this, propertyState);
    }

    /**
     * 
     * @returns {*}
     */
    getValue() {
        const propertyState = propertyStates.get(this);
        return JSON.parse(propertyState.jsonValue);
    }

    /**
     * 
     * @param observer {(value: *) => Promise<void>}
     */
    addObserver(observer) {
        if ('function' != typeof observer) {
            throw new TypeError('Not a function');
        }
        callAsync(observer, this.getValue());
    }

    /**
     * 
     * @param observer {(value: *) => Promise<void>}
     */
    removeObserver(observer) {}
}

const stateValuesMap = new WeakMap;
export class State {
    /**
     * Creates a State object.
     * @param isImmutable {boolean}
     */
    constructor(init) {
        init = init || {};
        const {isImmutable, values, prefix} = init;
        Reflect.defineProperty(this, 'isImmutable', {value: !!isImmutable});
        const state = {
            propertyValues: values || Object.create(null),
            propertyObservers: Object.create(null),
            prefix: String(prefix || ''),
        };
        stateValuesMap.set(this, state);
    }

    /**
     * Get a Property by its name.
     * @param propertyName {string}
     * @returns {Property} Property with the given propertyName.
     */
    getProperty(propertyName) {
        const {propertyValues, propertyObservers, prefix} = stateValuesMap.get(this);
        propertyName = prefix + String(propertyName);
        return new class extends Property {
            constructor() {
                super(void 0);
            }

            getValue() {
                if (propertyName in propertyValues) {
                    return JSON.parse(propertyValues[propertyName]);
                }
                return void 0;
            }

            addObserver(observer) {
                if ('function' != typeof observer) {
                    throw new TypeError('Not a function');
                }
                if (!propertyObservers[propertyName]) {
                    propertyObservers[propertyName] = new Set;
                }
                propertyObservers[propertyName].add(observer);
            }

            removeObserver(observer) {
                if ('function' != typeof observer) {
                    throw new TypeError('Not a function');
                }
                if (!propertyObservers[propertyName]) {
                    return;
                }
                if (propertyObservers[propertyName].has(observer)) {
                    propertyObservers[propertyName].delete(observer);
                }
                if (propertyObservers[propertyName].size < 1) {
                    delete propertyObservers[propertyName];
                }
            }
        };
    }

    /**
     * Add a Reflector from a Topic.
     * @param topic {Topic}
     * @param topicReflector {(data: *) => Map<string, *>}
     */
    addTopicReflector(topic, topicReflector) {
        if (this.isImmutable) {
            throw new TypeError('Cannot modify immutable State');
        }
        if ('function' != typeof topicReflector) {
            throw new TypeError('Not a function');
        }
        const {propertyValues, propertyObservers, prefix} = stateValuesMap.get(this);
        topic.addListener(data => {
            const change = new Map(topicReflector(data) || []);
            for (const [propertyName, newValue] of change) {
                if ('undefined' == typeof newValue) {
                    delete propertyValues[prefix + propertyName];
                } else {
                    propertyValues[prefix + propertyName] = newValue;
                }
                const observers = propertyObservers[prefix + propertyName];
                if (observers) {
                    for (const observer of observers) {
                        callAsync(observer, newValue);
                    }
                }
            }
        });
    }

    /**
     * Add a Reflector from a Property.
     * @param property {Property}
     * @param propertyReflector {(value: *) => Map<string, *>}
     */
    addPropertyReflector(property, propertyReflector) {
        if (this.isImmutable) {
            throw new TypeError('Cannot modify immutable State');
        }
        if ('function' != typeof propertyReflector) {
            throw new TypeError('Not a function');
        }
        const {propertyValues, propertyObservers, prefix} = stateValuesMap.get(this);
        property.addObserver(value => {
            const change = new Map(propertyReflector(value) || []);
            for (const [propertyName, newValue] of change) {
                if ('undefined' == typeof newValue) {
                    delete propertyValues[prefix + propertyName];
                } else {
                    propertyValues[prefix + propertyName] = newValue;
                }
                const observers = propertyObservers[prefix + propertyName];
                if (observers) {
                    for (const observer of observers) {
                        callAsync(observer, newValue);
                    }
                }
            }
        });
    }
}

export class Session {
    constructor(appId) {
        appId = String(appId);
        Reflect.defineProperty(this, 'appId', {value: appId});
        const id = '';
        const state = new class extends State {
            //
        };
        Reflect.defineProperty(this, 'id', {value: id});
        Reflect.defineProperty(this, 'state', {value: state});
    }

    getTopic(topicName) {
        //
    }
}

export class Client {
    constructor(appId) {
        //
        appId = String(appId);
        const id = '';
        const state = new class extends State {
            //
        };
        Reflect.defineProperty(this, 'id', {value: id});
        Reflect.defineProperty(this, 'state', {value: state});
    }

    getTopic(topicName) {
        //
    }
}

export class App {
    constructor(id, state) {
        //
        const appId = String(id);
        const appState = new class extends State {
            //
        };
        const session = new Session;
        const client = new Client;
        Reflect.defineProperty(this, 'id', {value: appId});
        Reflect.defineProperty(this, 'state', {value: appState});
        Reflect.defineProperty(this, 'session', {value: session});
        Reflect.defineProperty(this, 'client', {value: client});
    }
}
