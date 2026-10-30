import { types } from 'util';
import * as vscode from 'vscode';

const LINE_WIDTH = 70;

interface GlobalPhrases {
    phrases: string[];
    time_stop: number;
    state?: boolean;
};

let phrase_welcom: GlobalPhrases = {
    phrases: [
        "Ready to write some code?",
        "Hey! I missed this workspace.",
        "Another day, another bug.",
        "I'm awake! Let's get to work.",
        "What are we building today?",
        "Welcome back, developer!",
    ],
    time_stop: 0,
    state: true,
};

let phrase_commit: GlobalPhrases = {
    phrases:[
        "Saved in history forever!",
        "Git happens!",
        "Commit successful. I'm proud!",
        "Another piece of the puzzle!",
    ],
    time_stop: 0,
    state: false,
};

let phrase_fix_error: GlobalPhrases = {
    phrases: [
        "Wait... did we fix it?",
    ],
    time_stop: 0,
    state: false,
};
let error_now = false;

let phrase_working: GlobalPhrases = {
    phrases: [
        "Interesting approach...",
        "One line at a time.",
        "Code is poetry!",
        "Focus mode: activated.",
        "This is getting exciting!"
    ],
    time_stop: 0,
    state: false,
};


let phrase: string = '';
GetRandomPhrase(phrase_welcom, 5000);

function BuildFrames(hash: string, experience: number, state_xp: string, phrase: string): string[][] {
    const head = [
        ' $ claudik',
        '',
        `   * ${phrase}`,
        '',
    ];
    const tail = [
        '       ▝▜█████▛▘',
        '         ▘▘ ▝▝',
        '',
        `   > last commit hash: ${hash}`,
        `   > experience: ${experience}xp   ${state_xp}`,
    ];
    return [
        [...head, '        ▐▛███▜▌', ...tail],
        [...head, '        ▐█████▌', ...tail],
        [...head, '        ▐▛███▜▌', ...tail],
    ];
}

function GetRandomPhrase(type_phrase: GlobalPhrases = phrase_working, show_time: number = 4000) {
    if (!phrase_fix_error.state || (type_phrase === phrase_fix_error)) {
        phrase = type_phrase.phrases[Math.floor(Math.random() * type_phrase.phrases.length)];
        type_phrase.time_stop = Date.now() + show_time;
        type_phrase.state = true;
    }
}

function CheckPhrasesTime() {
    const types: GlobalPhrases[] = [phrase_fix_error, phrase_welcom, phrase_commit, phrase_working];
    for (const type of types) {
        if (!error_now && type.state && Date.now() > type.time_stop){
            type.time_stop = 0;
            type.state = false;
            GetRandomPhrase();
            break;
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {

        let experience: number = context.globalState.get<number>('experience', 0);
        let prev_hash: string = context.globalState.get<string>('prev_hash', '');

        let state_xp: string = '';
        let time_xp_show = 0;

        async function AddExperience(amount: number) {
            experience += amount;
            state_xp = `+ ${amount}xp`;
            time_xp_show = Date.now() + 4000;

            await context.globalState.update('experience', experience);
        }

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showWarningMessage('Не удалось определить gitExtension');
            return;
        }

        const activated_extension = await gitExtension.activate();
        const gitAPI = activated_extension.getAPI(1);
        const repository = gitAPI.repositories[0];

        if (!repository) {
            vscode.window.showWarningMessage('Не удалось определить repository');
            return;
        }

        const writeEmitter = new vscode.EventEmitter<string>();
        let frame_index = 0;
        let timer: NodeJS.Timeout | undefined;
        let state_subscription: vscode.Disposable | undefined;

        const RenderFrame = () => {
            const hash = repository.state.HEAD?.commit ?? 'No commits yet';
            if (hash !== prev_hash) {
                AddExperience(50);
                prev_hash = hash;

                GetRandomPhrase(phrase_commit, 3000);

                context.globalState.update('prev_hash', prev_hash);
            }

            state_xp = Date.now() < time_xp_show ? state_xp : '';
            
            CheckPhrasesTime();

            const frames = BuildFrames(hash.slice(0, 7), experience, state_xp, phrase);

            let output = '\x1b[H';

            for (const line of frames[frame_index]) {
                output += line.padEnd(LINE_WIDTH, ' ') + '\r\n';
            }

            writeEmitter.fire(output);

            frame_index = (frame_index + 1) % frames.length;
        };

        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                RenderFrame();
                timer = setInterval(RenderFrame, 500);
                state_subscription = repository.state.onDidChange(RenderFrame);
            },
            close: () => {
                if (timer) {
                    clearInterval(timer);
                    timer = undefined;
                }
                state_subscription?.dispose();
                writeEmitter.dispose();
            },
        };

        const terminal = vscode.window.createTerminal({
            name: 'Claudik Terminal',
            pty,
        });
        terminal.show();
    });

    const diagnosticListener = vscode.languages.onDidChangeDiagnostics((event) => {
        for (const uri of event.uris) {
            const diagnostics = vscode.languages.getDiagnostics(uri);

            const errors = diagnostics.filter(  
            diagnostic =>
                diagnostic.severity === vscode.DiagnosticSeverity.Error
            );

            if (errors.length > 0) {
                phrase = `Oow... Detected ${errors.length} error(s)`;
                error_now = true;
            } else if (error_now) {
                GetRandomPhrase(phrase_fix_error, 2000);
                error_now = false;
            }
        }
    });
    
    context.subscriptions.push(diagnosticListener);
    context.subscriptions.push(disposable);
}

export function deactivate() {}