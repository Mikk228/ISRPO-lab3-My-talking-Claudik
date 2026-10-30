import * as vscode from 'vscode';

const LINE_WIDTH = 70;

function buildFrames(hash: string): string[][] {
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
        ` > last commit hash: ${hash}`,
    ];
    return [
        [...head, '        ▐▛███▜▌', ...tail],
        [...head, '        ▐█████▌', ...tail],
        [...head, '        ▐▛███▜▌', ...tail],
    ];
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {
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

        const renderFrame = () => {
            const hash = repository.state.HEAD?.commit ?? 'No commits yet';
            const frames = buildFrames(hash);

            let output = '\x1b[H';
            for (const line of frames[frameIndex]) {
                output += line.padEnd(LINE_WIDTH, ' ') + '\r\n';
            }
            writeEmitter.fire(output);

            frameIndex = (frameIndex + 1) % frames.length;
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