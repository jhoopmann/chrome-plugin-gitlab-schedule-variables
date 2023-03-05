const template = await (await fetch('template.html')).text();
const elements = {
    buttonCopy: document.getElementById('btn-copy'),
    buttonPaste: document.getElementById('btn-paste'),
    buttonExtendFields: document.getElementById('btn-extend-fields'),
    labelInfo: document.getElementById('label')
};
const [currentTab] = await chrome.tabs.query(
    {
        active: true,
        currentWindow: true
    }
);

function getStoredVariables() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(
            'variables',
            (result) => {
                if (result.variables !== undefined) {
                    resolve(JSON.parse(result.variables));
                } else {
                    reject('no variables in storage');
                }
            }
        )
    });
}

function enableElement(element) {
    element.classList.remove('disabled');
}

function currentDOMInsertVariables(variables, template) {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
            {
                target: {
                    tabId: currentTab.id,
                },
                func: function (variables, template) {
                    for (let variable of variables) {
                        const row = document.createElement('li');
                        row.classList.add('js-row', 'ci-variable-row');
                        row.innerHTML = template;
                        row.setAttribute('data-is-persisted', 'false');

                        const list = document.getElementsByClassName('ci-variable-list').item(0);
                        list.appendChild(row);

                        row.getElementsByClassName('js-ci-variable-input-variable-type').item(0)
                            .value = variable.type;
                        row.getElementsByClassName('js-ci-variable-input-key').item(0)
                            .value = variable.key;
                        row.getElementsByClassName('js-ci-variable-input-value').item(0)
                            .innerText = variable.value;
                    }
                    return variables;
                },
                args: [variables, template]
            },
            resolve
        );
    });
}

function currentDOMExtendFields() {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
            {
                target: {
                    tabId: currentTab.id,
                },
                func: function () {
                    document.querySelectorAll('div.ci-variable-body-item').forEach(
                        element => {
                            element.style.maxWidth = 'unset';
                            element.style.flex = '1';

                            element.getElementsByClassName('js-secret-value-placeholder').item(0)
                                .classList.add('hide');
                            element.getElementsByClassName('js-ci-variable-input-value').item(0)
                                .classList.remove('hide')
                        }
                    );
                }
            },
            resolve
        );
    });
}

function currentDOMReadVariables() {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
            {
                target: {
                    tabId: currentTab.id,
                },
                func: function () {
                    const inputKeys = document.getElementsByName('schedule[variables_attributes][][key]');
                    const inputTypes = document.getElementsByName('schedule[variables_attributes][][variable_type]');
                    const inputValues = document.getElementsByName('schedule[variables_attributes][][secret_value]');

                    const variables = [];
                    for (let i = 0; i < inputKeys.length; i++) {
                        if (inputKeys.item(i).value.length > 0) {
                            variables.push(
                                {
                                    type: inputTypes.item(i).value,
                                    key: inputKeys.item(i).value,
                                    value: inputValues.item(i).textContent
                                }
                            );
                        }
                    }

                    return variables;
                }
            },
            (result) => resolve(result[0].result)
        )
    });
}

chrome.scripting.executeScript(
    {
        target: {
            tabId: currentTab.id
        },
        function: function () {
            return document.getElementsByClassName('ci-variable-list').item(0) !== null;
        }
    },
    async (result) => {
        if (!result[0].result) {
            return;
        }

        elements.buttonCopy.addEventListener(
            'click',
            async () => {
                const variables = await currentDOMReadVariables();
                chrome.storage.local.set({'variables': JSON.stringify(variables)});
                window.close();
            }
        );
        enableElement(elements.buttonCopy);

        elements.buttonExtendFields.addEventListener(
            'click',
            async () => {
                await currentDOMExtendFields();
                window.close();
            }
        );
        enableElement(elements.buttonExtendFields);

        let variables = undefined;
        try {
            variables = await getStoredVariables();
            elements.labelInfo.innerText = Object.keys(variables).length + ' copied variables';
        } catch (ex) {
            elements.labelInfo.innerText = 'no copied variables';

            return;
        }
        elements.buttonPaste.addEventListener(
            'click',
            async () => {
                await currentDOMInsertVariables(variables, template);
                await currentDOMExtendFields();
                window.close();
            }
        );
        enableElement(elements.buttonPaste);
    }
);