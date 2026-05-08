import { createSlice } from '@reduxjs/toolkit';

interface UiState {
    paywallModalOpen: boolean;
}

const initialState: UiState = {
    paywallModalOpen: false,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        openPaywallModal(state) {
            state.paywallModalOpen = true;
        },
        closePaywallModal(state) {
            state.paywallModalOpen = false;
        },
    },
});

export const { openPaywallModal, closePaywallModal } = uiSlice.actions;
export default uiSlice.reducer;
