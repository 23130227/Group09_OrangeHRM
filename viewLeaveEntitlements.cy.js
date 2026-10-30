describe('template spec', () => {
   //TC01: Kiểm tra mở trang  Entitlements
  it('passes', () => {
cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('input[name="username"]').type('Admin')
    cy.get('input[name="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Đợi đăng nhập thành công
    cy.url().should('include', '/dashboard')

    // Chuyển sang trang Leave Entitlements
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')

    // Kiểm tra đã chuyển trang thành công
    cy.url().should('include', '/leave/viewLeaveEntitlements')
  })
  it('thu hien search ',()=>{
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
   cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')
    cy.get('#app input[placeholder="Type for hints..."]').click();
    cy.get('#app input[placeholder="Type for hints..."]').type('L');
    cy.get('.oxd-autocomplete-option')
      .filter(':visible')
      .should(($options) => {
        expect($options).to.have.length.greaterThan(0);
        expect($options.first().text().trim()).not.to.match(/searching|no records found/i);
      })
      .first()
      .click();
    cy.get('#app div:nth-child(2) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();

    cy.get('#app div:nth-child(3) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();
    cy.get('#app button.oxd-button').click();
  })
  it('kiem tra add entitlements',()=>{
        cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
    cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveEntitlements')
    cy.get('#app input[placeholder="Type for hints..."]').click();
    cy.get('#app input[placeholder="Type for hints..."]').type('L');
    cy.get('.oxd-autocomplete-option')
      .filter(':visible')
      .should(($options) => {
        expect($options).to.have.length.greaterThan(0);
        expect($options.first().text().trim()).not.to.match(/searching|no records found/i);
      })
      .first()
      .click();
    cy.get('#app div:nth-child(2) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();

    cy.get('#app div:nth-child(3) > div.oxd-input-group .oxd-select-text').click();
    cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();
    cy.get('#app button.oxd-button').click();
    cy.get('#app div.orangehrm-header-container button.oxd-button').click();
  })
})