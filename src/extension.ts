import * as vscode from 'vscode';

const LINE_WIDTH = 70;

function buildFrames(hash: string, experience: number, stateXp: string): string[][] {
    const head = [
        ' $ claude',
        '',
        '   ✻ Welcome to Claude Code!',
        '',
    ];
    const tail = [
        '       ▝▜█████▛▘',
        '         ▘▘ ▝▝',
        '',
        `         > last commit hash: ${hash}`,
        `         > experience: ${experience}xp   ${stateXp}`,
    ];
    return [
        [...head, '        ▐▛███▜▌', ...tail],
        [...head, '        ▐█████▌', ...tail],
        [...head, '        ▐▛███▜▌', ...tail],
    ];
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {

        let experience: number = context.globalState.get<number>('experience', 0);
        let prev_hash: string = context.globalState.get<string>('prev_hash', '');
        let stateXp: string = '';

        async function addExperience(amount: number) {
            experience += amount;
            stateXp = `+ ${amount}xp`;

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
        let frameIndex = 0;
        let timer: NodeJS.Timeout | undefined;
        let stateSubscription: vscode.Disposable | undefined;

        const renderFrame = () => { // 326e67b1e82286b9cb1018d564855b3f0ae91c7d
            const hash = repository.state.HEAD?.commit ?? 'No commits yet';
            if (hash !== prev_hash) {
                addExperience(50);
                prev_hash = hash;
            }
            const frames = buildFrames(hash, experience, stateXp);

            let output = '\x1b[H';
            for (const line of frames[frameIndex]) {
                output += line.padEnd(LINE_WIDTH, ' ') + '\r\n';
            }
            writeEmitter.fire(output);

            frameIndex = (frameIndex + 1) % frames.length;
            stateXp = '';
        };

        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                renderFrame();
                timer = setInterval(renderFrame, 500);
                stateSubscription = repository.state.onDidChange(renderFrame);
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