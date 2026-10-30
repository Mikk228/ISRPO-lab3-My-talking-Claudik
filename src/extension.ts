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

function buildFrames(hash: string, experience: number, state_xp: string, phrase: string): string[][] {
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
    return phrases[Math.floor(Math.random() * phrases.length)];
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {

        let experience: number = context.globalState.get<number>('experience', 0);
        let prev_hash: string = context.globalState.get<string>('prev_hash', '');

        let state_xp: string = '';
        let time_xp_show = 0;

        let phrase: string = GetRandomPhrase(phrase_welcom);

        async function AddExperience(amount: number) {
            experience += amount;
            state_xp = `+ ${amount}xp`;
            time_xp_show = Date.now() + 2000;

            await context.globalState.update('experience', experience);
        }    

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showWarningMessage('Не удалось определить gitExtension');
            return;
        }

        const activatedExtension = await gitExtension.activate();
        const gitAPI = activatedExtension.getAPI(1);
        const repository = gitAPI.repositories[0];

        if (!repository) {
            vscode.window.showWarningMessage('Не удалось определить repository');
            return;
        }

        const writeEmitter = new vscode.EventEmitter<string>();
        let frame_index = 0;
        let timer: NodeJS.Timeout | undefined;
        let stateSubscription: vscode.Disposable | undefined;

        const RenderFrame = () => {
            const hash = repository.state.HEAD?.commit ?? 'No commits yet';
            if (hash !== prev_hash) {
                AddExperience(50);
                prev_hash = hash;

                phrase = GetRandomPhrase(phrase_commits);

                context.globalState.update('prev_hash', prev_hash);
            }

            state_xp = Date.now() < time_xp_show ? state_xp : '';
            const frames = buildFrames(hash, experience, state_xp, phrase);

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
                stateSubscription = repository.state.onDidChange(RenderFrame);
            },
            close: () => {
                if (timer) {
                    clearInterval(timer);
                    timer = undefined;
                }
                stateSubscription?.dispose();
                writeEmitter.dispose();
            },
        };

        const terminal = vscode.window.createTerminal({
            name: 'Claudik Terminal',
            pty,
        });
        terminal.show();
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}