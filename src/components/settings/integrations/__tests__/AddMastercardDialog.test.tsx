import { act, cleanup, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactNode } from 'react'

import { EXISTING_CODE_ERROR_MESSAGE } from '~/core/form/existingCodeError'
import { MastercardIntegrationDetailsFragment } from '~/generated/graphql'
import { AllTheProviders, render } from '~/test-utils'

import { useAddMastercardDialog } from '../AddMastercardDialog'

const REQUIRED_ERROR = 'text_624ea7c29103fd010732ab7d'

const mockDialogOpen = jest.fn()
const mockUpdate = jest.fn()
const mockGetProviderByCode = jest.fn()
const mockAdd = jest.fn()
const mockDelete = jest.fn()

jest.mock('~/components/dialogs/FormDialogOpeningDialog', () => ({
  useFormDialogOpeningDialog: () => ({ open: mockDialogOpen, close: jest.fn() }),
}))

jest.mock('~/hooks/core/useInternationalization', () => ({
  useInternationalization: () => ({ translate: (key: string) => key }),
}))

jest.mock('~/generated/graphql', () => ({
  ...jest.requireActual('~/generated/graphql'),
  useUpdateMastercardPaymentProviderMutation: () => [mockUpdate],
  useGetProviderByCodeForMastercardLazyQuery: () => [mockGetProviderByCode],
  useAddMastercardPaymentProviderMutation: () => [mockAdd],
  useDeleteMastercardIntegrationMutation: () => [mockDelete],
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <AllTheProviders>{children}</AllTheProviders>
)

const provider: MastercardIntegrationDetailsFragment = {
  __typename: 'MastercardProvider',
  id: 'mastercard-provider-id',
  name: 'Test Integration',
  code: 'test_integration',
  merchantId: '••••••••7890',
  apiPassword: '••••••••abcd',
  webhookSecret: 'webhook-secret',
  region: 'eu',
  testMode: true,
}

const openDialog = async (
  data?: Parameters<ReturnType<typeof useAddMastercardDialog>['openAddMastercardDialog']>[0],
): Promise<{ submit: () => Promise<unknown>; container: HTMLElement }> => {
  const { result } = renderHook(() => useAddMastercardDialog(), { wrapper })

  act(() => {
    result.current.openAddMastercardDialog(data)
  })

  const dialogProps = mockDialogOpen.mock.calls[0][0]
  let container: HTMLElement = document.body

  await act(async () => {
    container = render(<>{dialogProps.children}</>).container
  })

  return { submit: dialogProps.form.submit, container }
}

const getFieldContent = (container: HTMLElement, fieldName: string): string => {
  const input = container.querySelector(`#${fieldName}`)

  return input?.closest('.MuiTextField-root')?.parentElement?.textContent ?? ''
}

describe('useAddMastercardDialog', () => {
  afterEach(cleanup)

  beforeEach(() => {
    jest.clearAllMocks()

    // Keep the dialog pending so the `.then` cleanup does not reset the form mid-test
    mockDialogOpen.mockImplementation(() => new Promise(() => {}))
    mockGetProviderByCode.mockResolvedValue({ data: { paymentProvider: null } })
  })

  describe('GIVEN a new connection', () => {
    describe('WHEN submitting without credentials', () => {
      it('THEN flags the merchant ID and API password as required', async () => {
        const { submit, container } = await openDialog()

        await act(async () => {
          await expect(submit()).rejects.toThrow()
        })

        expect(getFieldContent(container, 'merchantId')).toContain(REQUIRED_ERROR)
        expect(getFieldContent(container, 'apiPassword')).toContain(REQUIRED_ERROR)
        expect(getFieldContent(container, 'webhookSecret')).not.toContain(REQUIRED_ERROR)
        expect(mockAdd).not.toHaveBeenCalled()
      })
    })
  })

  describe('GIVEN an existing connection', () => {
    describe('WHEN submitting with the credential fields left blank', () => {
      it('THEN does not flag them and omits them from the update', async () => {
        const { submit, container } = await openDialog({ provider })

        await act(async () => {
          await expect(submit()).rejects.toThrow()
        })

        expect(getFieldContent(container, 'merchantId')).not.toContain(REQUIRED_ERROR)
        expect(mockUpdate).toHaveBeenCalledWith({
          variables: {
            input: {
              id: provider.id,
              name: provider.name,
              code: provider.code,
              region: 'eu',
              testMode: true,
              merchantId: undefined,
              apiPassword: undefined,
              webhookSecret: undefined,
            },
          },
        })
      })
    })

    describe('WHEN submitting with a new API password', () => {
      it('THEN sends only the credential that was typed', async () => {
        const user = userEvent.setup()
        const { submit, container } = await openDialog({ provider })

        const apiPasswordInput = container.querySelector('#apiPassword') as HTMLInputElement

        expect(apiPasswordInput.value).toBe('')

        await user.type(apiPasswordInput, 'new-password')

        await act(async () => {
          await expect(submit()).rejects.toThrow()
        })

        expect(mockUpdate).toHaveBeenCalledWith({
          variables: {
            input: expect.objectContaining({
              apiPassword: 'new-password',
              merchantId: undefined,
              webhookSecret: undefined,
            }),
          },
        })
      })
    })

    describe('WHEN the code is already taken by another provider', () => {
      it('THEN surfaces the shared duplicate-code message and does not update', async () => {
        mockGetProviderByCode.mockResolvedValue({
          data: { paymentProvider: { id: 'another-provider-id' } },
        })

        const { submit } = await openDialog({ provider })

        await act(async () => {
          await expect(submit()).rejects.toThrow()
        })

        expect(await screen.findByText(EXISTING_CODE_ERROR_MESSAGE)).toBeInTheDocument()
        expect(mockUpdate).not.toHaveBeenCalled()
      })
    })
  })
})
