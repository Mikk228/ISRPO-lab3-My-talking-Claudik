import * as vscode from 'vscode';

const LINE_WIDTH = 70;

const phrase_welcom = [
    "Ready to write some code?",
    "Hey! I missed this workspace.",
    "Another day, another bug.",
    "I'm awake! Let's get to work.",
    "What are we building today?",
    "Welcome back, developer!",
];
const phrase_commits = [
    "Saved in history forever!",
    "Git happens!",
    "Commit successful. I'm proud!",
    "Another piece of the puzzle!",
];
const phrase_errors = [];

const phrase_working = [
    "Interesting approach...",
    "One line at a time.",
    "Code is poetry!",
    "Focus mode: activated.",
    "This is getting exciting!"
];

let phrase: string = GetRandomPhrase(phrase_welcom);
let is_error_state: boolean = false;
let time_error_phrase = 0;

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

function GetRandomPhrase(phrases: string[]): string {
    return !is_error_state ? phrases[Math.floor(Math.random() * phrases.length)] : phrase;
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

                phrase = GetRandomPhrase(phrase_commits);

                context.globalState.update('prev_hash', prev_hash);
            }

            state_xp = Date.now() < time_xp_show ? state_xp : '';

            if (time_error_phrase && Date.now() > time_error_phrase) {
                time_error_phrase = 0;
                phrase = GetRandomPhrase(phrase_working);
            }
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
                phrase = `Claudik detected ${errors.length} error(s)`;
                is_error_state = true;
            } else {
                if (is_error_state) {
                    phrase = 'Wait... did we fix it?';
                    time_error_phrase = Date.now() + 3000;
                }
                is_error_state = false;
            }
        }
    });

    
    context.subscriptions.push(diagnosticListener);
    context.subscriptions.push(disposable);
}

export function deactivate() {}