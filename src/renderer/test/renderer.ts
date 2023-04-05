import type { ListrTestRendererOptions, ListrTestRendererTask, TestRendererOptions } from './renderer.interface'
import { TestRendererSerializer } from './renderer.interface'
import { ListrTaskEventType, ListrTaskState } from '@constants'
import type { ListrRenderer, ListrTaskMessage } from '@interfaces'
import { ListrLogger } from '@utils'

export class TestRenderer implements ListrRenderer {
  /** designates whether this renderer can output to a non-tty console */
  public static nonTTY = true
  /** renderer options for the verbose renderer */
  public static rendererOptions: TestRendererOptions = {
    subtasks: true,
    state: Object.values(ListrTaskState),
    output: true,
    prompt: true,
    title: true,
    messages: [ 'skip', 'error', 'retry', 'rollback', 'paused' ],
    messagesToStderr: [ 'error', 'rollback', 'retry' ],
    task: [
      'hasRolledBack',
      'isRollingBack',
      'isCompleted',
      'isSkipped',
      'hasFinalized',
      'hasSubtasks',
      'title',
      'hasReset',
      'hasTitle',
      'isPrompt',
      'isPaused',
      'isPending',
      'isSkipped',
      'isStarted',
      'hasFailed',
      'isEnabled',
      'isRetrying',
      'path'
    ],
    logger: ListrLogger
  }
  /** per task options for the verbose renderer */
  public static rendererTaskOptions: never

  private readonly logger: ListrLogger
  private serializer: TestRendererSerializer

  constructor (private readonly tasks: ListrTestRendererTask[], private readonly options: ListrTestRendererOptions) {
    this.options = { ...TestRenderer.rendererOptions, ...this.options }

    this.logger = new this.options.logger(this.options.loggerOptions)

    this.serializer = new TestRendererSerializer(this.options)
  }

  public render (): void {
    this.renderer(this.tasks)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public end (): void {}

  // verbose renderer multi-level
  private renderer (tasks: ListrTestRendererTask[]): void {
    return tasks?.forEach((task) => {
      if (this.options.subtasks) {
        task.on(ListrTaskEventType.SUBTASK, (subtasks) => {
          this.renderer(subtasks)
        })
      }

      if (this.options.state) {
        task.on(ListrTaskEventType.STATE, (state) => {
          this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.STATE, state, task))
        })
      }

      if (this.options.output) {
        task.on(ListrTaskEventType.OUTPUT, (data) => {
          this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.OUTPUT, data, task))
        })
      }

      if (this.options.prompt) {
        task.on(ListrTaskEventType.PROMPT, (prompt) => {
          this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.PROMPT, prompt, task))
        })
      }

      if (this.options.title) {
        task.on(ListrTaskEventType.TITLE, (title) => {
          this.logger.toStdout(this.serializer.serialize(ListrTaskEventType.TITLE, title, task))
        })
      }

      task.on(ListrTaskEventType.MESSAGE, (message) => {
        const parsed: ListrTaskMessage = Object.fromEntries(
          Object.entries(message)
            .map(([ key, value ]) => {
              if (this.options.messages.includes(key as keyof ListrTaskMessage)) {
                return [ key, value ]
              }
            })
            .filter(Boolean)
        )

        if (Object.keys(parsed).length > 0) {
          const output = this.serializer.serialize(ListrTaskEventType.MESSAGE, parsed, task)

          if (this.options.messagesToStderr.some((state) => Object.keys(parsed).includes(state))) {
            this.logger.toStderr(output)
          } else {
            this.logger.toStdout(output)
          }
        }
      })
    })
  }
}
